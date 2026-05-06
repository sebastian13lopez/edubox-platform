const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const Course = require('../models/Course');
const Historial = require('../models/Historial');
const User = require('../models/User');

// =============================================================
// ARCHIVO: agregaciones.js
// PROPÓSITO: Exponer endpoints que demuestran las 8 etapas del
//            Aggregation Pipeline de MongoDB dentro del contexto
//            real de la plataforma EduVox.
// =============================================================

// ─────────────────────────────────────────────────────────────
// AGREGACIÓN 1 — $group
// Agrupa los registros de actividad por estudiante y calcula:
//   • total de eventos generados
//   • suma de puntos (valor) acumulados en la clase
// Útil para: ranking general de participación
// ─────────────────────────────────────────────────────────────
router.get('/group/:cursoId', async (req, res) => {
  try {
    const resultado = await ActivityLog.aggregate([
      // Filtrar solo los logs de ese curso específico
      { $match: { clase_id: { $toString: req.params.cursoId } } },

      // Agrupar por estudiante y acumular métricas
      {
        $group: {
          _id: '$estudiante_id',           // Clave de agrupación
          totalEventos: { $sum: 1 },       // Contar cuántos eventos generó
          puntajeTotal: { $sum: '$valor' }, // Sumar todos los puntos obtenidos
          ultimaActividad: { $max: '$fecha' } // Fecha del evento más reciente
        }
      },

      // Ordenar del más activo al menos activo
      { $sort: { puntajeTotal: -1 } }
    ]);

    res.json({
      etapa: '$group',
      descripcion: 'Agrupa logs de actividad por estudiante y calcula puntaje acumulado',
      cursoId: req.params.cursoId,
      resultado
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en agregación $group', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// AGREGACIÓN 2 — $project
// Remodela los documentos de Historial para exponer solo los
// campos relevantes (sin el texto completo que puede ser enorme).
// Útil para: listar sesiones pasadas en el dashboard del estudiante
// ─────────────────────────────────────────────────────────────
router.get('/project', async (req, res) => {
  try {
    const resultado = await Historial.aggregate([
      // Proyectar solo los campos necesarios — SOLO inclusión (no mezclar con exclusión)
      // MongoDB no permite mezclar _id: 1 con textoCompleto: 0 en el mismo $project
      {
        $project: {
          _id: 1,
          curso_id: 1,
          profesor_id: 1,
          fecha: 1,
          estadisticas: 1,
          // Crear campo derivado: resumen de los primeros 120 bytes del texto
          resumen: { $substrBytes: ['$textoCompleto', 0, 120] }
          // textoCompleto NO se incluye → no aparece en el resultado (sin necesidad de excluirlo)
        }
      },
      // Ordenar por fecha descendente
      { $sort: { fecha: -1 } },
      // Limitar a los últimos 10 registros
      { $limit: 10 }
    ]);

    res.json({
      etapa: '$project',
      descripcion: 'Selecciona campos específicos del historial y crea campo "resumen" derivado de 120 chars',
      resultado
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en agregación $project', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// AGREGACIÓN 3 — $sort
// Ordena los cursos de la plataforma por cantidad de estudiantes
// inscritos (descendente) y por nombre (ascendente como desempate).
// Útil para: vista de administrador con cursos más populares
// ─────────────────────────────────────────────────────────────
router.get('/sort', async (req, res) => {
  try {
    const resultado = await Course.aggregate([
      // Añadir campo calculado: número de estudiantes en el array
      {
        $addFields: {
          cantidadEstudiantes: { $size: '$estudiantes' }
        }
      },

      // Ordenar: primero por mayor cantidad de estudiantes,
      // si empatan, orden alfabético por nombre del curso
      {
        $sort: {
          cantidadEstudiantes: -1, // Mayor cantidad primero
          nombre: 1                // Alfabético ascendente como desempate
        }
      },

      // Proyectar solo los campos relevantes para el ranking
      {
        $project: {
          nombre: 1,
          descripcion: 1,
          cantidadEstudiantes: 1,
          en_vivo: 1
        }
      }
    ]);

    res.json({
      etapa: '$sort',
      descripcion: 'Ordena cursos por cantidad de estudiantes inscritos (desc) y nombre (asc)',
      resultado
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en agregación $sort', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// AGREGACIÓN 4 — $match
// Filtra los registros de actividad de las últimas 2 horas
// para un tipo de evento específico (quiz correcto).
// Útil para: alertas en tiempo real del dashboard del profesor
// ─────────────────────────────────────────────────────────────
router.get('/match/:cursoId', async (req, res) => {
  try {
    const dosHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const resultado = await ActivityLog.aggregate([
      // Filtro principal: solo logs recientes del curso con quiz correcto
      {
        $match: {
          clase_id: { $toString: req.params.cursoId },
          tipo_evento: 'quiz_answered_correct',
          fecha: { $gte: dosHorasAtras }
        }
      },

      // Agrupar para obtener el recuento de aciertos
      {
        $group: {
          _id: '$estudiante_id',
          aciertos: { $sum: 1 },
          puntosGanados: { $sum: '$valor' }
        }
      },

      { $sort: { aciertos: -1 } }
    ]);

    res.json({
      etapa: '$match',
      descripcion: 'Filtra logs de quiz_correcto de las últimas 2 horas para el curso dado',
      cursoId: req.params.cursoId,
      desde: dosHorasAtras,
      resultado
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en agregación $match', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// AGREGACIÓN 5 — $limit
// Retorna el TOP 5 de estudiantes con mayor puntaje acumulado
// en toda la plataforma (ranking global).
// Útil para: sección de tabla de líderes (leaderboard)
// ─────────────────────────────────────────────────────────────
router.get('/limit', async (req, res) => {
  try {
    const resultado = await ActivityLog.aggregate([
      // Agrupar todos los logs por estudiante
      {
        $group: {
          _id: '$estudiante_id',
          puntajeTotal: { $sum: '$valor' },
          totalEventos: { $sum: 1 }
        }
      },

      // Ordenar de mayor a menor puntaje
      { $sort: { puntajeTotal: -1 } },

      // ETAPA $limit: tomar solo el TOP 5
      { $limit: 5 },

      // Proyecto final limpio
      {
        $project: {
          estudiante_id: '$_id',
          puntajeTotal: 1,
          totalEventos: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      etapa: '$limit',
      descripcion: 'Retorna el TOP 5 de estudiantes con mayor puntaje acumulado en la plataforma',
      resultado
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en agregación $limit', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// AGREGACIÓN 6 — $skip
// Paginación del historial de clases: saltar los primeros N
// registros para implementar páginas en el frontend.
// Útil para: historial de transcripciones con paginación
// ─────────────────────────────────────────────────────────────
router.get('/skip', async (req, res) => {
  try {
    const pagina = parseInt(req.query.pagina) || 1;
    const porPagina = parseInt(req.query.porPagina) || 5;
    const saltar = (pagina - 1) * porPagina;

    const resultado = await Historial.aggregate([
      // Ordenar por fecha descendente antes de paginar
      { $sort: { fecha: -1 } },

      // ETAPA $skip: saltar registros ya vistos
      { $skip: saltar },

      // Tomar solo los de esta página
      { $limit: porPagina },

      // Proyectar campos relevantes
      {
        $project: {
          curso_id: 1,
          profesor_id: 1,
          fecha: 1,
          'estadisticas.palabras': 1,
          resumen: { $substrBytes: ['$textoCompleto', 0, 80] }
        }
      }
    ]);

    res.json({
      etapa: '$skip',
      descripcion: `Paginación del historial: página ${pagina}, ${porPagina} registros por página, saltando ${saltar}`,
      pagina,
      porPagina,
      resultado
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en agregación $skip', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// AGREGACIÓN 7 — $unwind
// Deconstruye el array 'materiales' de cada curso, generando
// un documento por cada material individual.
// Útil para: listar y filtrar materiales de todos los cursos
// ─────────────────────────────────────────────────────────────
router.get('/unwind', async (req, res) => {
  try {
    const resultado = await Course.aggregate([
      // Solo cursos que tengan al menos un material
      { $match: { 'materiales.0': { $exists: true } } },

      // ETAPA $unwind: un documento por cada elemento del array materiales
      { $unwind: '$materiales' },

      // Proyectar para mostrar el nombre del curso + datos del material
      {
        $project: {
          nombreCurso: '$nombre',
          'material.titulo': '$materiales.titulo',
          'material.descripcion': '$materiales.descripcion',
          'material.url': '$materiales.url',
          'material.fecha': '$materiales.fecha'
        }
      },

      // Ordenar por fecha del material más reciente
      { $sort: { 'material.fecha': -1 } }
    ]);

    res.json({
      etapa: '$unwind',
      descripcion: 'Deconstruye el array materiales[] de cada curso en documentos individuales',
      resultado
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en agregación $unwind', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// AGREGACIÓN 8 — $lookup
// Une (JOIN) la colección ActivityLog con la colección Users
// para obtener el nombre del estudiante en cada registro de
// actividad sin usar populate() de Mongoose.
// Útil para: reporte detallado de actividad con nombres reales
// ─────────────────────────────────────────────────────────────
router.get('/lookup/:cursoId', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    let cursoObjectId;
    try {
      cursoObjectId = new mongoose.Types.ObjectId(req.params.cursoId);
    } catch {
      return res.status(400).json({ error: 'cursoId inválido' });
    }

    const resultado = await ActivityLog.aggregate([
      // Filtrar por curso
      { $match: { clase_id: cursoObjectId } },

      // ETAPA $lookup: unir con la colección 'users' usando el estudiante_id
      {
        $lookup: {
          from: 'users',              // Nombre real de la colección en MongoDB
          localField: 'estudiante_id', // Campo en ActivityLog
          foreignField: '_id',         // Campo en Users
          as: 'datosEstudiante'        // Nombre del array resultante
        }
      },

      // $unwind para aplanar el array datosEstudiante (un resultado por log)
      { $unwind: { path: '$datosEstudiante', preserveNullAndEmpty: true } },

      // Proyectar el resultado final con el nombre del estudiante incluido
      {
        $project: {
          tipo_evento: 1,
          valor: 1,
          fecha: 1,
          'estudiante.nombre': '$datosEstudiante.nombre',
          'estudiante.email': '$datosEstudiante.email',
          'estudiante.rol': '$datosEstudiante.rol'
        }
      },

      // Ordenar por fecha más reciente
      { $sort: { fecha: -1 } },

      // Limitar para no sobrecargar
      { $limit: 50 }
    ]);

    res.json({
      etapa: '$lookup',
      descripcion: 'Une ActivityLog con Users para obtener nombre del estudiante en cada evento (equivalente a JOIN en SQL)',
      cursoId: req.params.cursoId,
      resultado
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en agregación $lookup', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/agregaciones
// Endpoint de índice: lista todas las agregaciones disponibles
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    mensaje: 'Endpoints del Aggregation Pipeline de MongoDB — EduVox',
    agregaciones: [
      { etapa: '$group',   url: '/api/agregaciones/group/:cursoId',  descripcion: 'Agrupa logs de actividad por estudiante y acumula puntaje' },
      { etapa: '$project', url: '/api/agregaciones/project',         descripcion: 'Remodela documentos de historial, crea campo resumen' },
      { etapa: '$sort',    url: '/api/agregaciones/sort',            descripcion: 'Ordena cursos por cantidad de estudiantes inscritos' },
      { etapa: '$match',   url: '/api/agregaciones/match/:cursoId',  descripcion: 'Filtra logs de quiz correcto de las últimas 2 horas' },
      { etapa: '$limit',   url: '/api/agregaciones/limit',           descripcion: 'TOP 5 estudiantes con mayor puntaje global' },
      { etapa: '$skip',    url: '/api/agregaciones/skip?pagina=1',   descripcion: 'Paginación del historial de clases' },
      { etapa: '$unwind',  url: '/api/agregaciones/unwind',          descripcion: 'Deconstruye array de materiales de los cursos' },
      { etapa: '$lookup',  url: '/api/agregaciones/lookup/:cursoId', descripcion: 'JOIN entre ActivityLog y Users para obtener nombre del estudiante' },
    ]
  });
});

module.exports = router;
