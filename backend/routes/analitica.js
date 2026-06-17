const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const Course = require('../models/Course');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const Historial = require('../models/Historial');

// Cooldown por sala: evita spam de quizes
const quizCooldowns = new Map();
const QUIZ_COOLDOWN_MS = 30_000; // 30 segundos entre quizes por sala

// ─────────────────────────────────────────────────────────────────────
// GET /api/analitica/dashboard/admin (Global Dashboard Analytics)
// ─────────────────────────────────────────────────────────────────────
router.get('/dashboard/admin', async (req, res) => {
  try {
    const historiales = await Historial.find().sort({ fecha: 1 });
    
    const dashboardData = {
      labels: historiales.map(h => new Date(h.fecha).toLocaleDateString('es-CO')),
      duracion: historiales.map(h => Math.round((h.duracion || 0) / 60)), // en minutos
      asistencia: {
        presentes: historiales.map(h => (h.participantes || []).length),
        ausentes: historiales.map(h => (h.ausentes || []).length)
      },
      participacion: {
        mensajesTotales: historiales.reduce((acc, h) => acc + (h.metricasParticipacion ? h.metricasParticipacion.reduce((mAcc, m) => mAcc + m.mensajesCount, 0) : 0), 0),
        preguntasTotales: historiales.reduce((acc, h) => acc + (h.metricasParticipacion ? h.metricasParticipacion.reduce((mAcc, m) => mAcc + m.preguntas.length, 0) : 0), 0)
      }
    };
    
    res.json(dashboardData);
  } catch (err) {
    console.error('Error obteniendo dashboard global:', err);
    res.status(500).json({ error: 'Error obteniendo dashboard global' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/analitica/dashboard/profesor/:id (Dashboard Analytics Profesor)
// ─────────────────────────────────────────────────────────────────────
router.get('/dashboard/profesor/:id', async (req, res) => {
  try {
    const profesorId = req.params.id;
    const historiales = await Historial.find({ profesor_id: profesorId }).sort({ fecha: 1 });
    
    const dashboardData = {
      labels: historiales.map(h => new Date(h.fecha).toLocaleDateString('es-CO')),
      duracion: historiales.map(h => Math.round((h.duracion || 0) / 60)), // en minutos
      asistencia: {
        presentes: historiales.map(h => (h.participantes || []).length),
        ausentes: historiales.map(h => (h.ausentes || []).length)
      },
      participacion: {
        mensajesTotales: historiales.reduce((acc, h) => acc + (h.metricasParticipacion ? h.metricasParticipacion.reduce((mAcc, m) => mAcc + m.mensajesCount, 0) : 0), 0),
        preguntasTotales: historiales.reduce((acc, h) => acc + (h.metricasParticipacion ? h.metricasParticipacion.reduce((mAcc, m) => mAcc + m.preguntas.length, 0) : 0), 0)
      }
    };
    
    res.json(dashboardData);
  } catch (err) {
    console.error('Error obteniendo dashboard profesor:', err);
    res.status(500).json({ error: 'Error obteniendo dashboard profesor' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/analitica/registrar
// ─────────────────────────────────────────────────────────────────────
router.post('/registrar', async (req, res) => {
  try {
    const { estudiante_id, clase_id, tipo_evento, valor } = req.body;
    const nuevoEvento = new ActivityLog({ estudiante_id, clase_id, tipo_evento, valor: valor || 0 });
    await nuevoEvento.save();
    res.status(201).json(nuevoEvento);
  } catch (err) {
    console.error('Error registrando evento:', err);
    res.status(500).json({ error: 'Error registrando evento', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/analitica/dashboard/:cursoId
// ─────────────────────────────────────────────────────────────────────
router.get('/dashboard/:cursoId', async (req, res) => {
  try {
    const cursoId = req.params.cursoId;

    // Convertir a ObjectId para que ActivityLog.find() funcione correctamente
    // (clase_id en ActivityLog es de tipo ObjectId, no String)
    let cursoObjId;
    try { cursoObjId = new mongoose.Types.ObjectId(cursoId); }
    catch { return res.status(400).json({ error: 'cursoId inválido' }); }

    const curso = await Course.findById(cursoId).populate('estudiantes', 'nombre correo');
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

    const dosHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const logs = await ActivityLog.find({ clase_id: cursoObjId, fecha: { $gte: dosHorasAtras } });

    const dashboardStats = curso.estudiantes.map(estudiante => {
      const studentLogs = logs.filter(log => String(log.estudiante_id) === String(estudiante._id));
      let baseScore = 100;
      let correctQuizCount = 0;
      let focusLostCount = 0;

      studentLogs.forEach(log => {
        if (log.tipo_evento === 'tab_focus_lost') { focusLostCount++; baseScore -= 15; }
        else if (log.tipo_evento === 'quiz_answered_correct') { correctQuizCount++; baseScore += 10; }
        else if (log.tipo_evento === 'quiz_answered_incorrect') { baseScore += 2; }
      });

      const finalScore = Math.max(0, Math.min(100, baseScore));
      return {
        estudiante_id: estudiante._id,
        nombre: estudiante.nombre,
        score: finalScore,
        focusLostCount,
        correctQuizCount,
        estado: finalScore < 50 ? 'En Riesgo' : 'Estable'
      };
    });

    res.json(dashboardStats);
  } catch (err) {
    console.error('Error obteniendo dashboard:', err);
    res.status(500).json({ error: 'Error obteniendo dashboard' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Generador local de quiz MEJORADO (sin IA externa)
// ─────────────────────────────────────────────────────────────────────
function generarQuizLocal(texto) {
  const textoOriginal = texto;
  const textoL = texto.toLowerCase().replace(/[¡¿]/g, '');

  // Segmentar en oraciones útiles (mínimo 6 palabras, >25 chars)
  const oraciones = textoL
    .split(/[.!?;]/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).length >= 6 && s.length > 25);

  // Stop words ampliado
  const stopWords = new Set([
    'también','porque','según','sobre','entre','donde','cuando','cómo','como',
    'para','pero','sino','aunque','mientras','durante','después','antes','estar',
    'siendo','tienen','tiene','puede','pueden','estas','estos','había','hacer',
    'hacen','podría','desde','todas','todos','algún','alguna','dicho','forma',
    'parte','clase','decir','texto','hemos','hasta','mismo','misma','cuales',
    'dicha','cuyo','cuyos','cuya','aquí','allí','este','esta','aquel','aquella',
    'ellos','ellas','nosotros','vosotros','ustedes','usted','señor','señora',
    'entonces','ahora','bueno','vamos','osea','básicamente','digamos','ejemplo',
    'miren','verdad','cierto','importante','manera','mucho','muchos','mucha',
    'otro','otra','otros','otras','cada','algo','solo','sólo','siempre','nunca',
    'bien','mejor','peor','mayor','menor','gran','grande','pequeño','nuevo',
    'primera','segundo','tercer','cuarto','quinto'
  ]);

  // ── Extraer FRASES clave (bigramas y trigramas) ──
  const palabras = textoL.replace(/[.,;:()"]/g, '').split(/\s+/).filter(p => p.length > 3);
  const palabrasLimpias = palabras.filter(p => !stopWords.has(p) && p.length > 4);

  // Frecuencia de palabras individuales
  const freq = {};
  palabrasLimpias.forEach(p => { freq[p] = (freq[p] || 0) + 1; });
  const topPalabras = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w]) => w);

  // Extraer bigramas (frases de 2 palabras) que NO son stop words
  const bigramas = {};
  for (let i = 0; i < palabras.length - 1; i++) {
    const a = palabras[i], b = palabras[i + 1];
    if (!stopWords.has(a) && !stopWords.has(b) && a.length > 3 && b.length > 3) {
      const bi = `${a} ${b}`;
      bigramas[bi] = (bigramas[bi] || 0) + 1;
    }
  }
  const topBigramas = Object.entries(bigramas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  // Helper: capitalizar frase
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
  const capFrase = f => f.split(' ').map((w, i) => i === 0 ? cap(w) : w).join(' ');

  // ── Determinar el TEMA PRINCIPAL de la clase ──
  const temaPrincipal = topBigramas.length > 0 ? capFrase(topBigramas[0]) : cap(topPalabras[0] || 'tema');

  if (topPalabras.length < 3) {
    return {
      pregunta: `¿Cuál es el tema principal que se está desarrollando en esta clase?`,
      opciones: [temaPrincipal, 'Un tema no mencionado', 'Ninguno de los anteriores'],
      correcta: temaPrincipal
    };
  }

  const candidatos = [];

  // ── PATRÓN 1: "¿Cuál de estos TEMAS se discutió?" (usa bigramas, no palabras sueltas) ──
  if (topBigramas.length >= 1 && topPalabras.length >= 4) {
    // Usar bigramas (frases de 2+ palabras) para evitar preguntas de una sola palabra
    const mencionado = capFrase(topBigramas[0]);
    const distractoresPool = [
      'Teoría de conjuntos', 'Análisis estadístico', 'Cálculo integral',
      'Redes neuronales', 'Álgebra lineal', 'Mecánica cuántica',
      'Diseño gráfico', 'Marketing digital', 'Economía global',
      'Biología molecular', 'Química orgánica', 'Filosofía moderna',
      'Programación funcional', 'Inteligencia artificial', 'Robótica industrial'
    ].filter(d => !textoL.includes(d.toLowerCase()));

    const distElegidos = distractoresPool.sort(() => Math.random() - 0.5).slice(0, 2);
    candidatos.push({
      pregunta: `¿Cuál de los siguientes temas se discutió en la explicación del profesor?`,
      correcta: mencionado,
      distractores: distElegidos,
      peso: 3
    });
  }

  // ── PATRÓN 2: "¿Cuál es la idea principal sobre [tema]?" (usa frases, NO palabras sueltas) ──
  if (topBigramas.length >= 3) {
    const central = capFrase(topBigramas[0]);
    const d1 = capFrase(topBigramas[topBigramas.length - 1]);
    const d2 = capFrase(topBigramas[Math.max(1, topBigramas.length - 2)]);
    if (central !== d1 && central !== d2 && d1 !== d2) {
      candidatos.push({
        pregunta: `¿Cuál es la idea principal que se desarrolló en la clase sobre "${temaPrincipal}"?`,
        correcta: central,
        distractores: [d1, d2],
        peso: 4
      });
    }
  }

  // ── PATRÓN 3: Definición con frase completa ──
  for (const oracion of oraciones) {
    const m = oracion.match(/(\w{4,}(?:\s+\w{4,})?)\s+(?:es|son|se define como|se refiere a|consiste en)\s+([\w\s]{8,60})/);
    if (m && !stopWords.has(m[1].split(' ')[0])) {
      const concepto = capFrase(m[1].trim());
      // Tomar la definición hasta un máximo de 7 palabras completas
      const defPalabras = m[2].trim().split(/\s+/);
      const defCompleta = defPalabras.slice(0, Math.min(7, defPalabras.length)).join(' ');

      if (defCompleta.length >= 10 && defCompleta.split(/\s+/).length >= 3) {
        // Distractores: usar fragmentos de OTRAS definiciones o frases genéricas plausibles
        const distractoresAcademicos = [
          'Un método de evaluación continua',
          'Una herramienta de análisis cuantitativo',
          'Un modelo de representación abstracta',
          'El resultado de un proceso iterativo',
          'Una técnica de resolución de problemas',
          'Un componente del marco teórico',
          'Un proceso de transformación de datos',
          'Una estructura de organización jerárquica',
          'Un conjunto de reglas y procedimientos',
          'Una forma de clasificar la información'
        ].filter(d => !textoL.includes(d.toLowerCase().split(' ')[2] || ''));

        const dists = distractoresAcademicos.sort(() => Math.random() - 0.5).slice(0, 2);

        candidatos.push({
          pregunta: `Según la explicación, ¿qué es "${concepto}"?`,
          correcta: capFrase(defCompleta),
          distractores: dists,
          peso: 6
        });
      }
    }
  }

  // ── PATRÓN 4: Verdadero/Falso reformulado como opción múltiple ──
  if (oraciones.length >= 2) {
    // Tomar una oración real y crear versiones falsas
    const oracionReal = oraciones[Math.floor(Math.random() * Math.min(oraciones.length, 4))];
    const frase = capFrase(oracionReal.split(/\s+/).slice(0, 12).join(' '));

    if (frase.length > 20) {
      candidatos.push({
        pregunta: `¿Cuál de las siguientes afirmaciones se mencionó en la clase?`,
        correcta: frase,
        distractores: [
          'Eso no fue parte de la explicación',
          'El profesor mencionó lo contrario'
        ],
        peso: 2
      });
    }
  }

  // ── PATRÓN 5: Completar oración (mejorado, usa frases no palabras sueltas) ──
  for (const oracion of oraciones) {
    if (oracion.length < 30 || oracion.length > 120) continue;
    const keyword = topBigramas.find(bi => oracion.includes(bi)) || topPalabras.find(t => oracion.includes(t));
    if (keyword && keyword.length > 4) {
      const completada = oracion.replace(keyword, '______');
      if (completada.includes('______')) {
        const correcta = capFrase(keyword);
        const dists = (topBigramas.length > 1 ? topBigramas : topPalabras)
          .filter(t => t !== keyword)
          .slice(0, 2)
          .map(capFrase);
        if (dists.length === 2) {
          candidatos.push({
            pregunta: `Completa la siguiente frase: "${capFrase(completada)}"`,
            correcta,
            distractores: dists,
            peso: 5
          });
          break;
        }
      }
    }
  }

  // ── PATRÓN 6: Causa-efecto ──
  const conectoresCausa = ['porque', 'ya que', 'dado que', 'debido a que', 'puesto que'];
  for (const oracion of oraciones) {
    for (const conector of conectoresCausa) {
      const idx = oracion.indexOf(conector);
      if (idx > 10) {
        const parteEfecto = oracion.substring(0, idx).trim();
        const parteCausa = oracion.substring(idx + conector.length).trim();

        // Tomar las últimas 5 palabras COMPLETAS del efecto
        const efectoWords = parteEfecto.split(/\s+/).filter(w => w.length > 2);
        const efecto = capFrase(efectoWords.slice(-5).join(' '));
        // Tomar las primeras 6 palabras COMPLETAS de la causa
        const causaWords = parteCausa.split(/\s+/).filter(w => w.length > 2);
        const causa = capFrase(causaWords.slice(0, 6).join(' '));

        if (efecto.length > 12 && causa.length > 12 && efectoWords.length >= 2 && causaWords.length >= 2) {
          candidatos.push({
            pregunta: `Según la explicación, ¿por qué ${efecto.toLowerCase()}?`,
            correcta: causa,
            distractores: [
              'No se explicó la razón en clase',
              'Es un proceso aleatorio sin causa definida'
            ],
            peso: 5
          });
          break; // Un solo patrón causa-efecto es suficiente
        }
      }
    }
  }

  // ── Selección inteligente: preferir candidatos con mayor peso ──
  const validos = candidatos.filter(c =>
    c.distractores.length === 2 &&
    c.correcta.length > 5 &&
    c.distractores.every(d => d.length > 5) &&
    c.correcta !== c.distractores[0] &&
    c.correcta !== c.distractores[1]
  );

  let plantilla;
  if (validos.length > 0) {
    // Ordenar por peso descendente, con algo de aleatoriedad
    validos.sort((a, b) => (b.peso || 0) - (a.peso || 0));
    // Elegir de los top 3
    const topN = validos.slice(0, Math.min(3, validos.length));
    plantilla = topN[Math.floor(Math.random() * topN.length)];
  } else {
    // Fallback final: pregunta genérica sobre el tema principal
    plantilla = {
      pregunta: `¿Cuál de los siguientes temas es el foco principal de la explicación del profesor?`,
      correcta: temaPrincipal,
      distractores: ['Un tema no relacionado con la clase', 'Ninguno de los mencionados']
    };
  }

  // Helper: truncar en límite de palabra
  const truncarLimpio = (str, maxLen = 50) => {
    if (str.length <= maxLen) return str;
    const cortado = str.substring(0, maxLen);
    const ultimoEspacio = cortado.lastIndexOf(' ');
    return (ultimoEspacio > 10 ? cortado.substring(0, ultimoEspacio) : cortado).trim();
  };

  // Asegurar que las opciones están limpias y mezcladas
  const correctaTruncada = truncarLimpio(plantilla.correcta);
  const opciones = [correctaTruncada, ...plantilla.distractores.map(d => truncarLimpio(d))]
    .sort(() => Math.random() - 0.5);

  return { pregunta: plantilla.pregunta, opciones, correcta: correctaTruncada };
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/analitica/generar-quiz
// ─────────────────────────────────────────────────────────────────────
router.post('/generar-quiz', async (req, res) => {
  try {
    const { texto, claseId } = req.body;

    if (!texto || texto.trim().length < 20) {
      return res.status(400).json({ error: 'Texto insuficiente para generar un quiz.' });
    }

    // Cooldown: max 1 quiz por sala cada 30 segundos
    const ahora = Date.now();
    const clave = claseId || 'global';
    const ultimoQuiz = quizCooldowns.get(clave) || 0;
    const tiempoRestante = Math.ceil((ultimoQuiz + QUIZ_COOLDOWN_MS - ahora) / 1000);

    if (ahora - ultimoQuiz < QUIZ_COOLDOWN_MS) {
      return res.status(429).json({
        tipo: 'cooldown',
        error: 'Cooldown activo',
        detalle: `Espera ${tiempoRestante}s antes de generar otro quiz.`,
        espera: tiempoRestante
      });
    }

    quizCooldowns.set(clave, ahora);

    // Tomar los últimos 1500 caracteres (contexto más reciente) en lugar de los primeros 600
    const contextoClase = texto.length > 1500 ? texto.substring(texto.length - 1500) : texto;

    const prompt = `Eres un evaluador académico experto en pedagogía activa. Analiza la transcripción de clase y diseña UNA pregunta de opción múltiple de COMPRENSIÓN PROFUNDA.

REGLAS ESTRICTAS:
1. PROHIBIDO hacer preguntas literales como "¿Qué palabra dijo el profesor?", "¿Qué término mencionó?" o "¿Cuál de estas palabras se dijo en clase?". NUNCA preguntes por una palabra o término textual que el profesor haya dicho.
2. La pregunta DEBE evaluar si el estudiante ENTENDIÓ el concepto, no si lo memorizó. Usa preguntas de tipo: "¿Por qué...?", "¿Para qué sirve...?", "¿Qué pasaría si...?", "¿Cuál es la relación entre...?", "¿Cómo se aplica...?".
3. Las 3 opciones deben ser frases completas de al menos 6 palabras cada una, plausibles y distintas entre sí.
4. La respuesta correcta NO debe contener palabras textuales del profesor como respuesta única. Debe ser una explicación o interpretación.
5. No uses frases incompletas ni dejes ideas a medias.

Transcripción a analizar:
"${contextoClase}"

Responde SOLO con un JSON válido (sin backticks, markdown ni texto extra):
{
  "pregunta": "¿[Pregunta conceptual que evalúe comprensión]?",
  "opciones": ["[Opción A - frase completa]", "[Opción B - frase completa]", "[Opción C - frase completa]"],
  "correcta": "[Opción exacta que es correcta]"
}
IMPORTANTE: "correcta" debe ser idéntica a una de las "opciones". Orden aleatorio.`;

    let responseText = '';
    let fuente = '';

    // Intento 1: Groq
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });
        const completion = await groq.chat.completions.create({
          model: 'llama3-8b-8192',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
          max_tokens: 450
        });
        responseText = completion.choices[0]?.message?.content || '';
        fuente = 'Groq';
      } catch (groqErr) {
        console.warn('[Quiz] Groq falló:', groqErr.message);
      }
    }

    // Intento 2: Gemini
    if (!responseText && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        fuente = 'Gemini';
      } catch (geminiErr) {
        console.warn('[Quiz] Gemini falló:', geminiErr.message);
      }
    }

    // Intento 3: Generador local (siempre funciona)
    if (!responseText) {
      const quizLocal = generarQuizLocal(texto);
      console.log('[Quiz] Generado localmente ✓');
      return res.json({ ...quizLocal, _fuente: 'local' });
    }

    console.log(`[Quiz] Generado con ${fuente} ✓`);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch
      ? jsonMatch[0]
      : responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const quizData = JSON.parse(jsonString);
    res.json({ ...quizData, _fuente: fuente });

  } catch (err) {
    console.error('Error generando quiz:', err.message || err);
    try {
      const quizLocal = generarQuizLocal(req.body.texto || '');
      return res.json({ ...quizLocal, _fuente: 'local' });
    } catch (_) {
      res.status(500).json({ error: 'Error generando quiz', detalle: err.message });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────
// Corrector local de ortografía y puntuación (sin IA)
// ─────────────────────────────────────────────────────────────────────
function corregirOrtografiaLocal(texto) {
  if (!texto || !texto.trim()) return texto || '';
  
  let t = texto.trim();

  // 1. Correcciones de palabras mal reconocidas por el speech-to-text
  const reemplazos = {
    // Palabras juntas que deben ir separadas
    'aver': 'a ver', 'osea': 'o sea', 'ósea': 'o sea',
    'atravez': 'a través', 'atraves': 'a través', 'através': 'a través',
    'enserio': 'en serio', 'envez': 'en vez', 'almenos': 'al menos',
    'talvez': 'tal vez', 'nose': 'no sé', 'porfavor': 'por favor',
    'osea': 'o sea', 'ósea': 'o sea', 'sinembargo': 'sin embargo',
    'poreso': 'por eso', 'portanto': 'por tanto', 'esdecir': 'es decir',
    'aveces': 'a veces', 'amenudo': 'a menudo', 'sobretodo': 'sobre todo',
    'entorno': 'en torno', 'afuera': 'a fuera', 'asimismo': 'así mismo',
    'enfrente': 'en frente', 'acontinuacion': 'a continuación',
    // Tildes faltantes: palabras comunes
    'tambien': 'también', 'asi': 'así', 'mas': 'más', 'dia': 'día',
    'despues': 'después', 'ademas': 'además', 'aqui': 'aquí',
    'alla': 'allá', 'ahi': 'ahí', 'todavia': 'todavía',
    'facil': 'fácil', 'dificil': 'difícil', 'rapido': 'rápido',
    'numero': 'número', 'metodo': 'método', 'codigo': 'código',
    'logica': 'lógica', 'logico': 'lógico', 'basico': 'básico',
    'basica': 'básica', 'tecnica': 'técnica', 'tecnico': 'técnico',
    'practica': 'práctica', 'practico': 'práctico', 'analisis': 'análisis',
    'informatica': 'informática', 'matematica': 'matemática',
    'matematicas': 'matemáticas', 'fisica': 'física', 'quimica': 'química',
    'biologica': 'biológica', 'biologico': 'biológico',
    'gestion': 'gestión', 'informacion': 'información',
    'programacion': 'programación', 'aplicacion': 'aplicación',
    'funcion': 'función', 'relacion': 'relación', 'operacion': 'operación',
    'explicacion': 'explicación', 'evaluacion': 'evaluación',
    'solucion': 'solución', 'condicion': 'condición',
    'comunicacion': 'comunicación', 'organizacion': 'organización',
    'presentacion': 'presentación', 'investigacion': 'investigación',
    'definicion': 'definición', 'clasificacion': 'clasificación',
    'ecuacion': 'ecuación', 'ecuaciones': 'ecuaciones',
    'calculo': 'cálculo', 'grafico': 'gráfico', 'grafica': 'gráfica',
    'teorico': 'teórico', 'teorica': 'teórica', 'teoria': 'teoría',
    'hipotesis': 'hipótesis', 'sintesis': 'síntesis',
    'parametro': 'parámetro', 'parametros': 'parámetros',
    'capitulo': 'capítulo', 'pagina': 'página',
    'proximo': 'próximo', 'proxima': 'próxima', 'ultimo': 'último',
    'ultima': 'última', 'unico': 'único', 'unica': 'única',
    'especifico': 'específico', 'especifica': 'específica',
    'electronico': 'electrónico', 'electronica': 'electrónica',
    'automatico': 'automático', 'automatica': 'automática',
    'pedagogico': 'pedagógico', 'pedagogica': 'pedagógica',
    'didactica': 'didáctica', 'didactico': 'didáctico',
    'economica': 'económica', 'economico': 'económico', 'economia': 'economía',
    'historico': 'histórico', 'historica': 'histórica',
    'politica': 'política', 'politico': 'político',
    'filosofia': 'filosofía', 'filosofico': 'filosófico',
    'caracteristica': 'característica', 'caracteristicas': 'características',
    'especificamente': 'específicamente', 'basicamente': 'básicamente',
    'tecnologia': 'tecnología', 'metodologia': 'metodología',
    'categoria': 'categoría', 'estrategia': 'estrategia',
    'energia': 'energía', 'geometria': 'geometría',
    'area': 'área', 'atomo': 'átomo', 'molecula': 'molécula',
    'celula': 'célula', 'organo': 'órgano',
    // Errores comunes del reconocimiento de voz
    'halla': 'haya', 'valla': 'vaya', 'echo': 'hecho',
    'hay': 'ahí', 'aya': 'haya',
    // Verbos y conjugaciones sin tilde
    'esta': 'está', 'estan': 'están', 'sera': 'será',
    'seran': 'serán', 'podra': 'podrá', 'tendra': 'tendrá',
    'hara': 'hará', 'sabra': 'sabrá', 'saldra': 'saldrá',
    'debera': 'deberá', 'deberian': 'deberían',
    'podrian': 'podrían', 'tendrian': 'tendrían',
    'estaria': 'estaría', 'seria': 'sería', 'haria': 'haría',
  };

  // Reemplazos de frases interrogativas/exclamativas
  const reemplazosFrases = {
    'que es': 'qué es', 'como es': 'cómo es',
    'como se': 'cómo se', 'donde esta': 'dónde está',
    'cuando es': 'cuándo es', 'por que': 'por qué',
    'para que': 'para qué', 'cual es': 'cuál es',
    'cuales son': 'cuáles son', 'cuanto es': 'cuánto es',
    'como funciona': 'cómo funciona', 'como podemos': 'cómo podemos',
    'que significa': 'qué significa', 'que quiere decir': 'qué quiere decir',
  };

  // Aplicar reemplazos de frases primero (tienen prioridad)
  for (const [mal, bien] of Object.entries(reemplazosFrases)) {
    const regex = new RegExp(mal, 'gi');
    t = t.replace(regex, bien);
  }

  // Aplicar reemplazos palabra por palabra (case insensitive)
  for (const [mal, bien] of Object.entries(reemplazos)) {
    const regex = new RegExp(`\\b${mal}\\b`, 'gi');
    t = t.replace(regex, bien);
  }

  // 2. Capitalización: primera letra de cada oración
  t = t.replace(/(^|[.!?]\s+)([a-záéíóúñ])/g, (match, sep, letra) => {
    return sep + letra.toUpperCase();
  });

  // Capitalizar la primera letra del texto si empieza en minúscula
  if (t.length > 0 && t[0] === t[0].toLowerCase() && t[0] !== t[0].toUpperCase()) {
    t = t[0].toUpperCase() + t.slice(1);
  }

  // 3. Agregar punto final si no termina en puntuación
  if (t.length > 5 && !/[.!?]$/.test(t.trim())) {
    t = t.trim() + '.';
  }

  // 4. Limpiar espacios múltiples
  t = t.replace(/\s{2,}/g, ' ');

  // 5. Asegurar espacio después de puntuación
  t = t.replace(/([.!?,;:])([A-ZÁÉÍÓÚa-záéíóú])/g, '$1 $2');

  // 6. Corregir comas antes de conjunciones comunes (mejora legibilidad)
  t = t.replace(/ (pero|sin embargo|no obstante|aunque|además) /gi, (m, conj) => `, ${conj.toLowerCase()} `);
  // Evitar doble coma
  t = t.replace(/,\s*,/g, ',');

  return t;
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/analitica/corregir-ortografia
// ─────────────────────────────────────────────────────────────────────
router.post('/corregir-ortografia', async (req, res) => {
  const { texto } = req.body;
  if (!texto || !texto.trim()) return res.json({ textoCorregido: texto || '' });

  const promptOrtografia = `Eres un corrector ortográfico profesional de español. Tu ÚNICA tarea es corregir el siguiente texto que viene de una transcripción de voz.

Reglas:
1. Corrige TODAS las tildes faltantes (también, más, está, función, programación, etc.)
2. Corrige errores de puntuación: agrega comas donde corresponda, puntos al final de oraciones, y signos de interrogación/exclamación si el tono lo sugiere.
3. Capitaliza correctamente las oraciones (primera letra de cada oración en mayúscula).
4. NO cambies el significado, NO agregues palabras, NO resumas, NO expliques.
5. Responde ÚNICAMENTE con el texto corregido. Sin comillas, sin "Texto corregido:", sin explicaciones.

Texto a corregir:
${texto}`;

  // Intento 1: Groq
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });
      const completion = await groq.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'Eres un corrector ortográfico. Solo devuelves el texto corregido, sin explicaciones ni formato adicional.' },
          { role: 'user', content: promptOrtografia }
        ],
        temperature: 0.1,
        max_tokens: 500
      });
      let textoCorregido = completion.choices[0]?.message?.content?.trim() || texto;
      // Limpiar si el modelo agregó comillas o prefijos innecesarios
      textoCorregido = textoCorregido.replace(/^["']|["']$/g, '').replace(/^Texto corregido:\s*/i, '').trim();
      console.log('[Ortografía] Corregido con Groq ✓');
      return res.json({ textoCorregido });
    } catch (e) {
      console.warn('[Ortografía] Groq falló:', e.message);
    }
  }

  // Intento 2: Gemini
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(promptOrtografia);
      let textoCorregido = result.response.text().trim();
      textoCorregido = textoCorregido.replace(/^["']|["']$/g, '').replace(/^Texto corregido:\s*/i, '').trim();
      console.log('[Ortografía] Corregido con Gemini ✓');
      return res.json({ textoCorregido });
    } catch (e) {
      console.warn('[Ortografía] Gemini falló:', e.message);
    }
  }

  // Intento 3: Corrector LOCAL (siempre funciona)
  const textoCorregido = corregirOrtografiaLocal(texto);
  console.log('[Ortografía] Corregido localmente ✓');
  res.json({ textoCorregido });
});

module.exports = router;

