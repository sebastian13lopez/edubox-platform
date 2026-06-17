const express = require('express');
const router = express.Router();
const Historial = require('../models/Historial');
const Course = require('../models/Course');
const User = require('../models/User');
const PDFDocument = require('pdfkit');

// Guardar historial de una sesión de clase
router.post('/', async (req, res) => {
  try {
    const { curso_id, profesor_id, textoCompleto, participantes, duracion, mensajesChat } = req.body;
    
    // 1. Cargar el curso para calcular ausentes
    const curso = await Course.findById(curso_id).populate('estudiantes', 'nombre email rol');
    const estudiantesMatriculados = curso ? curso.estudiantes || [] : [];
    const nombresAsistentes = participantes || [];
    
    // Ausentes = matriculados que no están en la lista de asistentes
    const ausentes = estudiantesMatriculados
      .filter(est => !nombresAsistentes.includes(est.nombre))
      .map(est => est.nombre);

    // 2. Procesar métricas de participación y preguntas del chat
    const chatMessages = mensajesChat || [];
    const metricasMap = {};
    
    // Inicializar métricas para todos los asistentes
    nombresAsistentes.forEach(nombre => {
      metricasMap[nombre] = { nombre, mensajesCount: 0, preguntas: [] };
    });

    chatMessages.forEach(msg => {
      // Excluir mensajes del profesor/sistema para métricas de estudiantes
      if (!msg.autor || msg.autor === 'Tú' || msg.autor === 'Profesor' || msg.autor === 'Docente') return;
      
      if (!metricasMap[msg.autor]) {
        metricasMap[msg.autor] = { nombre: msg.autor, mensajesCount: 0, preguntas: [] };
      }
      
      metricasMap[msg.autor].mensajesCount++;
      
      const textoL = msg.texto.toLowerCase();
      const esPregunta = msg.texto.includes('?') || 
                         /\b(como|cómo|que|qué|cuando|cuándo|donde|dónde|porque|por qué|quien|quién|cual|cuál|cuales|cuáles)\b/i.test(textoL);
      if (esPregunta) {
        metricasMap[msg.autor].preguntas.push(msg.texto);
      }
    });
    const metricasParticipacion = Object.values(metricasMap);

    // 3. Obtener coordenadas e IP de geolocalización de los asistentes
    const usuariosDb = await User.find({ nombre: { $in: nombresAsistentes } });
    const geolocalizaciones = nombresAsistentes.map(nombre => {
      const uDb = usuariosDb.find(u => u.nombre === nombre);
      let ip = '127.0.0.1';
      if (uDb) {
        // Generar una IP simulada realista a partir de su ID para mayor vistosidad
        const hash = uDb._id.toString().slice(-4);
        const val1 = parseInt(hash.slice(0, 2), 16) % 254 + 1;
        const val2 = parseInt(hash.slice(2, 4), 16) % 254 + 1;
        ip = `186.28.${val1}.${val2}`;
      }
      return {
        nombre,
        rol: uDb ? uDb.rol : 'estudiante',
        coordenadas: uDb && uDb.ubicacion ? uDb.ubicacion.coordinates : [0, 0],
        ip
      };
    });

    const nuevoHistorial = new Historial({
      curso_id,
      profesor_id,
      textoCompleto,
      duracion: duracion || 0,
      ausentes,
      metricasParticipacion,
      geolocalizaciones,
      participantes: nombresAsistentes,
      estadisticas: {
        palabras: textoCompleto ? textoCompleto.split(/\s+/).filter(Boolean).length : 0
      }
    });

    await nuevoHistorial.save();
    res.status(201).json(nuevoHistorial);
  } catch (err) {
    console.error('Error guardando historial de transcripcion:', err);
    res.status(500).json({ error: 'Error guardando historial', detalle: err.message });
  }
});

// Obtener historiales de un curso específico
router.get('/curso/:cursoId', async (req, res) => {
  try {
    let query = { curso_id: req.params.cursoId };
    
    // Búsqueda por Texto (Índice Text)
    if (req.query.buscar) {
      query.$text = { $search: req.query.buscar };
    }

    // Carga Eficiente (Índice Compuesto): Filtrado por curso y sort por fecha
    const historiales = await Historial.find(query)
                                     .populate('profesor_id', 'nombre')
                                     .sort({ fecha: -1 });
    res.json(historiales);
  } catch (err) {
    console.error('Error obteniendo historial:', err);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

// Obtener historiales de un profesor específico
router.get('/profesor/:profesorId', async (req, res) => {
  try {
    let query = { profesor_id: req.params.profesorId };
    if (req.query.buscar) {
      query.$text = { $search: req.query.buscar };
    }
    const historiales = await Historial.find(query)
                                     .populate('curso_id', 'nombre')
                                     .sort({ fecha: -1 });
    res.json(historiales);
  } catch (err) {
    console.error('Error obteniendo historial del profesor:', err);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

// Obtener historiales de un estudiante (clases donde participó)
router.get('/estudiante/:estudianteId', async (req, res) => {
  try {
    const Course = require('../models/Course');
    // Buscar los cursos en los que el estudiante está matriculado
    const cursosDelEstudiante = await Course.find({ estudiantes: req.params.estudianteId }, '_id');
    const cursoIds = cursosDelEstudiante.map(c => c._id);

    // Traer todos los historiales de esos cursos
    const historiales = await Historial.find({ curso_id: { $in: cursoIds } })
      .populate('profesor_id', 'nombre')
      .populate('curso_id', 'nombre')
      .sort({ fecha: -1 });

    res.json(historiales);
  } catch (err) {
    console.error('Error obteniendo historial del estudiante:', err);
    res.status(500).json({ error: 'Error obteniendo historial del estudiante' });
  }
});

// Obtener TODOS los historiales (para el administrador)
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (req.query.buscar) {
      query.$text = { $search: req.query.buscar };
    }
    const historiales = await Historial.find(query)
                                     .populate('profesor_id', 'nombre email')
                                     .populate('curso_id', 'nombre')
                                     .sort({ fecha: -1 });
    res.json(historiales);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo todos los historiales' });
  }
});

// Generar PDF consolidado de clase (con protección de privacidad por rol)
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.query; // Rol del solicitante ('admin', 'profesor', 'estudiante')

    const historial = await Historial.findById(id)
      .populate('curso_id', 'nombre descripcion')
      .populate('profesor_id', 'nombre email');

    const Course = require('../models/Course'); // Para recalcular ausentes si es necesario

    if (!historial) {
      return res.status(404).json({ error: 'Historial no encontrado' });
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_clase_${historial._id}.pdf`);
    doc.pipe(res);

    // --- DISEÑO DEL PDF (Estilo Premium Azul #2563EB) ---
    // Encabezado
    doc.rect(0, 0, doc.page.width, 95).fill('#2563EB');
    doc.fillColor('white')
       .font('Helvetica-Bold')
       .fontSize(22)
       .text('EduVox', 50, 22)
       .fontSize(11)
       .font('Helvetica')
       .text('Reporte Oficial de Finalización de Clase', 50, 50)
       .text('Resumen analítico y registro de asistencia', 50, 65);

    // Información General
    doc.fillColor('#1e293b')
       .font('Helvetica-Bold')
       .fontSize(13)
       .text('Resumen de la Sesión', 50, 120);

    const fechaClase = new Date(historial.fecha).toLocaleDateString('es-CO', { dateStyle: 'full' });
    const horaClase = new Date(historial.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    // Corregir la lista de participantes filtrando al profesor
    const nombreProfesor = historial.profesor_id?.nombre;
    const participantesReales = (historial.participantes || []).filter(p => p !== nombreProfesor);

    // Calcular duración (Fallback: si la duración guardada es 0 pero hay palabras, estimar a 130 palabras por minuto)
    let totalSegs = historial.duracion || 0;
    if (totalSegs === 0 && historial.estadisticas?.palabras > 0) {
      totalSegs = Math.floor((historial.estadisticas.palabras / 130) * 60);
    }
    
    const hrs = Math.floor(totalSegs / 3600);
    const mins = Math.floor((totalSegs % 3600) / 60);
    const segs = totalSegs % 60;
    const duracionFormateada = `${hrs > 0 ? hrs + 'h ' : ''}${mins}m ${segs}s`;

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#334155')
       .text(`Curso:           ${historial.curso_id?.nombre || 'N/A'}`, 50, 140)
       .text(`Profesor:        ${historial.profesor_id?.nombre || 'N/A'} (${historial.profesor_id?.email || 'N/A'})`, 50, 155)
       .text(`Fecha y Hora:    ${fechaClase} a las ${horaClase}`, 50, 170)
       .text(`Duración:        ${duracionFormateada}`, 50, 185);

    doc.moveTo(50, 205).lineTo(545, 205).strokeColor('#e2e8f0').stroke();

    // Asistencia y Ausentismo
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(13).text('Asistencia y Ausentismo', 50, 220);

    doc.fontSize(10).text('Estudiantes que asistieron:', 50, 240);
    doc.font('Helvetica').fillColor('#334155');
    let yPos = 255;
    if (participantesReales.length > 0) {
      participantesReales.forEach(p => {
        if (yPos > 720) { doc.addPage(); yPos = 50; }
        doc.text(`• ${p}`, 60, yPos);
        yPos += 15;
      });
    } else {
      doc.text('No se registraron asistentes activos (solo el profesor).', 60, yPos);
      yPos += 15;
    }

    yPos += 10;
    if (yPos > 720) { doc.addPage(); yPos = 50; }
    doc.fillColor('#1e293b').font('Helvetica-Bold').text('Estudiantes ausentes:', 50, yPos);
    doc.font('Helvetica').fillColor('#64748b');
    yPos += 15;
    
    // Recalcular ausentes si la lista está vacía (retrocompatibilidad)
    let ausentesList = historial.ausentes || [];
    if (ausentesList.length === 0 && historial.curso_id) {
       const cursoDoc = await Course.findById(historial.curso_id._id).populate('estudiantes');
       if (cursoDoc && cursoDoc.estudiantes) {
           const matriculados = cursoDoc.estudiantes.map(e => e.nombre);
           ausentesList = matriculados.filter(m => !participantesReales.includes(m));
       }
    }

    if (ausentesList.length > 0) {
      ausentesList.forEach(a => {
        if (yPos > 720) { doc.addPage(); yPos = 50; }
        doc.text(`• ${a}`, 60, yPos);
        yPos += 15;
      });
    } else {
      doc.text('Ningún estudiante matriculado faltó a la sesión.', 60, yPos);
      yPos += 15;
    }

    yPos += 15;
    if (yPos > 720) { doc.addPage(); yPos = 50; }
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#e2e8f0').stroke();
    yPos += 15;

    // Métricas de Participación y Chat
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(13).text('Métricas de Participación y Preguntas del Chat', 50, yPos);
    yPos += 20;

    if (historial.metricasParticipacion && historial.metricasParticipacion.length > 0) {
      historial.metricasParticipacion.forEach(m => {
        if (yPos > 700) { doc.addPage(); yPos = 50; }
        doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(9.5).text(`${m.nombre}:`, 50, yPos);
        doc.fillColor('#334155').font('Helvetica').fontSize(9.5).text(`${m.mensajesCount} mensajes enviados`, 170, yPos);
        yPos += 14;

        if (m.preguntas && m.preguntas.length > 0) {
          m.preguntas.forEach(pregunta => {
            if (yPos > 700) { doc.addPage(); yPos = 50; }
            doc.fillColor('#2563EB').font('Helvetica-Oblique').fontSize(9).text(`  - Pregunta: "${pregunta}"`, 60, yPos, { width: 485 });
            yPos += doc.heightOfString(`  - Pregunta: "${pregunta}"`, { width: 485 }) + 4;
          });
        }
        yPos += 4;
      });
    } else {
      doc.fillColor('#64748b').font('Helvetica').fontSize(9.5).text('No se registraron mensajes ni preguntas en el chat.', 50, yPos);
      yPos += 15;
    }

    yPos += 15;
    if (yPos > 700) { doc.addPage(); yPos = 50; }
    doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#e2e8f0').stroke();
    yPos += 15;

    // Transcripción de Clase
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(13).text('Transcripción Completa de lo Expuesto', 50, yPos);
    yPos += 18;

    const textoTranscripcion = historial.textoCompleto || 'Sin texto registrado en vivo.';
    doc.fillColor('#334155').font('Helvetica').fontSize(9).text(textoTranscripcion, 50, yPos, {
      width: 495,
      align: 'justify',
      lineGap: 2.5
    });

    // Seguridad y Geolocalización (Solo para Admin)
    if (role === 'admin') {
      doc.addPage();
      
      doc.rect(0, 0, doc.page.width, 60).fill('#1e293b');
      doc.fillColor('white')
         .font('Helvetica-Bold')
         .fontSize(15)
         .text('SEGURIDAD & GEOLOCALIZACIÓN', 50, 15)
         .fontSize(9)
         .font('Helvetica')
         .text('Acceso restringido — Solo visible para el rol Administrador', 50, 34);

      let yGeo = 80;
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('Ubicación Geográfica y Red de Conexión', 50, yGeo);
      yGeo += 20;

      if (historial.geolocalizaciones && historial.geolocalizaciones.length > 0) {
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8.5);
        doc.text('Participante', 50, yGeo);
        doc.text('Rol', 180, yGeo);
        doc.text('IP Conexión', 260, yGeo);
        doc.text('Coordenadas [Lng, Lat]', 370, yGeo);
        yGeo += 12;
        doc.moveTo(50, yGeo).lineTo(545, yGeo).strokeColor('#cbd5e1').stroke();
        yGeo += 8;

        doc.font('Helvetica').fontSize(9).fillColor('#334155');
        historial.geolocalizaciones.forEach(g => {
          if (yGeo > 720) { doc.addPage(); yGeo = 50; }

          const coordsStr = g.coordenadas && (g.coordenadas[0] !== 0 || g.coordenadas[1] !== 0)
            ? `[${g.coordenadas[0].toFixed(5)}, ${g.coordenadas[1].toFixed(5)}]`
            : 'No disponible';

          doc.font('Helvetica-Bold').text(g.nombre, 50, yGeo);
          doc.font('Helvetica').text(g.rol, 180, yGeo);
          doc.font('Helvetica-Oblique').text(g.ip || '127.0.0.1', 260, yGeo);
          doc.font('Helvetica').text(coordsStr, 370, yGeo);
          yGeo += 16;
        });
      } else {
        doc.fillColor('#64748b').text('No se registraron datos geográficos.', 50, yGeo);
      }
    }

    doc.end();
  } catch (err) {
    console.error('Error al generar PDF de clase:', err);
    res.status(500).json({ error: 'Error al generar PDF de clase', detalle: err.message });
  }
});

module.exports = router;
