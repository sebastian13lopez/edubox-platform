const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Course = require('../models/Course');
const ActivityLog = require('../models/ActivityLog');
const Historial = require('../models/Historial');

// =============================================================
// ARCHIVO: operadores.js
// PROPÓSITO: Demostrar el uso de operadores de comparación y
//            lógicos de MongoDB en el contexto real de EduVox.
// =============================================================

// ─────────────────────────────────────────────────────────────
// OPERADORES DE COMPARACIÓN
// ─────────────────────────────────────────────────────────────

// ── $gt / $gte — Mayor que / Mayor o igual que ───────────────
// Endpoint: GET /api/operadores/comparacion/estudiantes-activos
// Retorna estudiantes que tengan un puntaje acumulado MAYOR O IGUAL
// a un umbral dado. Útil para identificar estudiantes destacados.
router.get('/comparacion/estudiantes-activos', async (req, res) => {
  try {
    const umbral = parseInt(req.query.umbral) || 3;

    // $gte: solo logs con valor (puntos) >= umbral
    const logs = await ActivityLog.find({
      valor: { $gte: umbral }
    })
      .select('estudiante_id tipo_evento valor fecha')
      .sort({ valor: -1 })
      .limit(20);

    res.json({
      operador: '$gte (Mayor o igual que)',
      descripcion: `Registros de actividad donde el valor de puntos >= ${umbral}`,
      umbral,
      totalEncontrados: logs.length,
      resultados: logs
    });
  } catch (err) {
    res.status(500).json({ error: 'Error con $gte', detalle: err.message });
  }
});

// ── $lt / $lte — Menor que / Menor o igual que ──────────────
// Endpoint: GET /api/operadores/comparacion/cursos-pequenos
// Retorna historiales con pocas palabras (clases cortas).
// Umbral: transcripciones con menos de N palabras.
router.get('/comparacion/historial-corto', async (req, res) => {
  try {
    const maxPalabras = parseInt(req.query.max) || 100;

    // $lt: solo historiales con menos de maxPalabras palabras
    const historiales = await Historial.find({
      'estadisticas.palabras': { $lt: maxPalabras }
    })
      .select('curso_id fecha estadisticas')
      .sort({ 'estadisticas.palabras': 1 })
      .limit(10);

    res.json({
      operador: '$lt (Menor que)',
      descripcion: `Historiales con menos de ${maxPalabras} palabras transcritas`,
      maxPalabras,
      totalEncontrados: historiales.length,
      resultados: historiales
    });
  } catch (err) {
    res.status(500).json({ error: 'Error con $lt', detalle: err.message });
  }
});

// ── $ne — No es igual a ──────────────────────────────────────
// Endpoint: GET /api/operadores/comparacion/profesores-activos
// Retorna todos los profesores cuyo estado NO ES 'Pendiente'.
// Útil para el panel de administración de gestión de usuarios.
router.get('/comparacion/profesores-activos', async (req, res) => {
  try {
    // $ne: excluir profesores con estado 'Pendiente'
    const profesores = await User.find({
      rol: 'profesor',
      estado: { $ne: 'Pendiente' }
    }).select('-password');

    res.json({
      operador: '$ne (No es igual a)',
      descripcion: "Profesores cuyo estado NO ES 'Pendiente' (aprobados o activos)",
      totalEncontrados: profesores.length,
      resultados: profesores
    });
  } catch (err) {
    res.status(500).json({ error: 'Error con $ne', detalle: err.message });
  }
});

// ── $in — Valor dentro de una lista ─────────────────────────
// Endpoint: GET /api/operadores/comparacion/eventos-gamificacion
// Retorna solo los logs relacionados a quiz (correcto o incorrecto).
// Filtra usando $in con un array de tipos de evento válidos.
router.get('/comparacion/eventos-gamificacion', async (req, res) => {
  try {
    // $in: buscar documentos donde tipo_evento esté en el array dado
    const eventosGamificacion = ['quiz_answered_correct', 'quiz_answered_incorrect'];

    const logs = await ActivityLog.find({
      tipo_evento: { $in: eventosGamificacion }
    })
      .select('estudiante_id clase_id tipo_evento valor fecha')
      .sort({ fecha: -1 })
      .limit(25);

    res.json({
      operador: '$in (Dentro de un conjunto de valores)',
      descripcion: 'Logs cuyo tipo_evento está dentro del conjunto de eventos de gamificación',
      eventosConsultados: eventosGamificacion,
      totalEncontrados: logs.length,
      resultados: logs
    });
  } catch (err) {
    res.status(500).json({ error: 'Error con $in', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// OPERADORES LÓGICOS
// ─────────────────────────────────────────────────────────────

// ── $or — Al menos UNA condición debe cumplirse ──────────────
// Endpoint: GET /api/operadores/logicos/buscar-usuario?q=texto
// Busca usuarios por nombre O por email que contengan el texto.
// Útil para: barra de búsqueda en el panel de administración.
router.get('/logicos/buscar-usuario', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.status(400).json({ error: 'Parámetro de búsqueda "q" requerido' });
    }

    const regex = new RegExp(q, 'i'); // Búsqueda insensible a mayúsculas

    // $or: encontrar usuarios que coincidan en nombre O en email
    const usuarios = await User.find({
      $or: [
        { nombre: { $regex: regex } },
        { email: { $regex: regex } }
      ]
    }).select('-password');

    res.json({
      operador: '$or (Al menos una condición se cumple)',
      descripcion: `Usuarios cuyo nombre OR email contiene: "${q}"`,
      busqueda: q,
      totalEncontrados: usuarios.length,
      resultados: usuarios
    });
  } catch (err) {
    res.status(500).json({ error: 'Error con $or', detalle: err.message });
  }
});

// ── $and — TODAS las condiciones deben cumplirse ─────────────
// Endpoint: GET /api/operadores/logicos/logs-hoy/:cursoId
// Retorna logs de un curso específico Y del día de hoy.
// $and es útil cuando necesitas repetir el mismo campo con distintas
// condiciones (ej. rango de fechas en el mismo campo).
router.get('/logicos/logs-hoy/:cursoId', async (req, res) => {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    // $and con dos condiciones sobre el mismo campo 'fecha'
    const logs = await ActivityLog.find({
      $and: [
        { clase_id: { $toString: req.params.cursoId } }, // Condición 1: curso específico
        { fecha: { $gte: inicioDia } },                  // Condición 2: desde el inicio del día
        { fecha: { $lte: finDia } }                      // Condición 3: hasta el fin del día
      ]
    })
      .select('estudiante_id tipo_evento valor fecha')
      .sort({ fecha: -1 });

    res.json({
      operador: '$and (Todas las condiciones se cumplen)',
      descripcion: 'Logs del curso dado Y dentro del rango de hoy (múltiples condiciones sobre fecha)',
      cursoId: req.params.cursoId,
      rangoFecha: { desde: inicioDia, hasta: finDia },
      totalEncontrados: logs.length,
      resultados: logs
    });
  } catch (err) {
    res.status(500).json({ error: 'Error con $and', detalle: err.message });
  }
});

// ── $not — Invierte el resultado de un filtro ────────────────
// Endpoint: GET /api/operadores/logicos/usuarios-sin-ubicacion
// Retorna usuarios cuyas coordenadas NO son las predeterminadas [0, 0].
// Equivale a: encontrar usuarios QUE SÍ tienen ubicación registrada.
router.get('/logicos/usuarios-con-ubicacion', async (req, res) => {
  try {
    // $not: invierte la condición — excluye los que tienen coordenadas [0,0]
    const usuarios = await User.find({
      'ubicacion.coordinates': {
        $not: { $eq: [0, 0] }
      }
    }).select('nombre email rol ubicacion');

    res.json({
      operador: '$not (Invierte el resultado del filtro)',
      descripcion: 'Usuarios cuya ubicación NO es [0, 0] (tienen coordenadas reales registradas)',
      totalEncontrados: usuarios.length,
      resultados: usuarios
    });
  } catch (err) {
    res.status(500).json({ error: 'Error con $not', detalle: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/operadores
// Endpoint índice: lista todos los operadores implementados
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    mensaje: 'Endpoints de Operadores de Comparación y Lógicos — EduVox',
    operadores_comparacion: [
      { op: '$gte', url: '/api/operadores/comparacion/estudiantes-activos?umbral=3',  descripcion: 'Logs con puntaje >= umbral' },
      { op: '$lt',  url: '/api/operadores/comparacion/historial-corto?max=100',       descripcion: 'Historiales con menos de N palabras' },
      { op: '$ne',  url: '/api/operadores/comparacion/profesores-activos',            descripcion: "Profesores con estado != 'Pendiente'" },
      { op: '$in',  url: '/api/operadores/comparacion/eventos-gamificacion',          descripcion: 'Logs cuyo tipo_evento está en el conjunto de quiz' },
    ],
    operadores_logicos: [
      { op: '$or',  url: '/api/operadores/logicos/buscar-usuario?q=texto',  descripcion: 'Busca por nombre OR email' },
      { op: '$and', url: '/api/operadores/logicos/logs-hoy/:cursoId',       descripcion: 'Logs del curso del día de hoy' },
      { op: '$not', url: '/api/operadores/logicos/usuarios-con-ubicacion',  descripcion: 'Usuarios con coordenadas reales (NOT [0,0])' },
    ]
  });
});

module.exports = router;
