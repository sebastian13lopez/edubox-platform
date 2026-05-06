const express = require('express');
const router = express.Router();
const Historial = require('../models/Historial');

// Guardar historial de una sesión de clase
router.post('/', async (req, res) => {
  try {
    const { curso_id, profesor_id, textoCompleto, participantes } = req.body;
    
    const nuevoHistorial = new Historial({
      curso_id,
      profesor_id,
      textoCompleto,
      participantes: participantes || [],
      estadisticas: {
        palabras: textoCompleto ? textoCompleto.split(' ').length : 0
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

module.exports = router;
