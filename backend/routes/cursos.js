const express = require('express');
const router = express.Router();
const Course = require('../models/Course'); // Importamos tu modelo

// --- POST / (Crear curso) ---
router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion, profesor_id, estudiantes_ids } = req.body;
    
    // Crear la instancia del nuevo curso
    const nuevoCurso = new Course({
      nombre,
      descripcion,
      profesor_id,
      estudiantes: estudiantes_ids || [] // Si no vienen estudiantes, inicializa array vacío
    });

    await nuevoCurso.save();
    res.status(201).json(nuevoCurso);
  } catch (error) {
    console.error('Error al crear el curso:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor al crear el curso' });
  }
});

// --- GET / (Obtener todos los cursos) ---
router.get('/', async (req, res) => {
  try {
    // Aquí es donde brilla el .populate() reemplazando a JOIN
    const cursos = await Course.find()
      .populate('profesor_id', 'nombre email') // Del profesor_id trae solo nombre y email de su colección "Users"
      .populate('estudiantes', 'nombre email'); // Lo mismo pero con el array de estudiantes
      
    res.json(cursos);
  } catch (error) {
    console.error('Error al obtener los cursos:', error);
    res.status(500).json({ mensaje: 'Error obteniendo los cursos' });
  }
});

// --- GET /profesor/:profesorId (Mis Clases - Profesor) ---
router.get('/profesor/:profesorId', async (req, res) => {
  try {
    const { profesorId } = req.params;
    
    // Busca los cursos donde el campo "profesor_id" coincida con el que llega en la URL
    const cursos = await Course.find({ profesor_id: profesorId })
      .populate('profesor_id', 'nombre email')
      .populate('estudiantes', 'nombre email');

    res.json(cursos);
  } catch (error) {
    console.error('Error obteniendo cursos del profesor:', error);
    res.status(500).json({ mensaje: 'Error al obtener cursos del profesor' });
  }
});

// --- GET /estudiante/:estudianteId (Mis Clases - Estudiante) ---
router.get('/estudiante/:estudianteId', async (req, res) => {
  try {
    const { estudianteId } = req.params;
    
    // Mongoose es mágico aquí: busca automáticamente si estudianteId está DENTRO del array "estudiantes"
    const cursos = await Course.find({ estudiantes: estudianteId })
      .populate('profesor_id', 'nombre email')
      .populate('estudiantes', 'nombre email');

    res.json(cursos);
  } catch (error) {
    console.error('Error obteniendo cursos del estudiante:', error);
    res.status(500).json({ mensaje: 'Error al obtener cursos del estudiante' });
  }
});
// --- DELETE /:id (Eliminar curso - ADMIN) ---
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cursoEliminado = await Course.findByIdAndDelete(id);
    if (!cursoEliminado) {
      return res.status(404).json({ mensaje: 'Curso no encontrado' });
    }
    res.json({ mensaje: 'Curso borrado exitosamente del historial directivo' });
  } catch (error) {
    console.error('Error al eliminar el curso con ID:', error);
    res.status(500).json({ mensaje: 'Error crítico del servidor al intentar borrar el curso' });
  }
});
module.exports = router;
