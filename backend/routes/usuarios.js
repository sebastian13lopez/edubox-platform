const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// --- RUTA: Obtener todos los profesores (o los que estén pendientes) ---
// GET /api/usuarios/pendientes
router.get('/pendientes', async (req, res) => {
  try {
    // Busca en MongoDB todos los documentos donde el 'rol' sea 'profesor'
    // Podrías agregar { rol: 'profesor', estado: 'Pendiente' } si tuvieras ese campo.
    const profesoresPendientes = await User.find({ rol: 'profesor' }).select('-password'); 
    
    // Devuelve la lista en formato JSON
    res.json(profesoresPendientes);
  } catch (error) {
    console.error('Error obteniendo usuarios pendientes:', error);
    res.status(500).json({ mensaje: 'Error al consultar la base de datos' });
  }
});

// --- RUTA: Obtener todos los usuarios (para listar profesores y estudiantes) ---
router.get('/', async (req, res) => {
  try {
    const usuarios = await User.find().select('-password');
    res.json(usuarios);
  } catch(error) {
    res.status(500).json({ mensaje: 'Error obteniendo usuarios' });
  }
});
// --- RUTA: Crear profesor manualmente por el Admin ---
router.post('/profesor/crear', async (req, res) => {
  try {
    const { nombre, correo, password, telefono, tituloProfesional } = req.body;
    const email = correo;

    let usuario = await User.findOne({ email });
    if (usuario) {
      return res.status(400).json({ mensaje: 'El correo ya está registrado' });
    }

    usuario = new User({ 
      nombre, 
      email, 
      password, 
      rol: 'profesor',
      estado: 'Activo', // Se aprueba automáticamente
      telefono, 
      tituloProfesional 
    });

    const salt = await bcrypt.genSalt(10);
    usuario.password = await bcrypt.hash(password, salt);

    await usuario.save();
    
    const usuarioCreado = await User.findById(usuario._id).select('-password');
    res.status(201).json(usuarioCreado);

  } catch (error) {
    console.error('Error creando profesor desde admin:', error);
    res.status(500).json({ mensaje: 'Error al crear profesor' });
  }
});

// --- RUTA: Aprobar a un profesor ---
router.put('/profesor/aprobar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Actualizamos el estado a 'Aprobado' para permitirle login o acceso
    const profesor = await User.findByIdAndUpdate(id, { estado: 'Aprobado' }, { returnDocument: 'after' }).select('-password');
    if (!profesor) {
      return res.status(404).json({ mensaje: 'Profesor no encontrado' });
    }
    res.json(profesor);
  } catch (error) {
    console.error('Error al aprobar profesor:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el estado del profesor' });
  }
});

// --- RUTA: Eliminar usuario (Ej: Admin deniega solicitud) ---
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioEliminado = await User.findByIdAndDelete(id);
    if (!usuarioEliminado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Usuario eliminado del sistema' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error interno al intentar eliminar usuario' });
  }
});

// ─────────────────────────────────────────────────────────────
// ÍNDICE GEOESPACIAL (2DSphere) — Endpoints relacionados
// ─────────────────────────────────────────────────────────────

// --- RUTA: Actualizar ubicación del usuario (llamado al hacer login) ---
// PUT /api/usuarios/:id/ubicacion
// Recibe: { latitud: Number, longitud: Number }
// MongoDB almacena coordenadas como [longitud, latitud] (orden GeoJSON)
router.put('/:id/ubicacion', async (req, res) => {
  try {
    const { id } = req.params;
    const { latitud, longitud } = req.body;

    if (latitud === undefined || longitud === undefined) {
      return res.status(400).json({ mensaje: 'Se requieren latitud y longitud' });
    }

    // Actualizar el campo 'ubicacion' con formato GeoJSON Point
    const usuarioActualizado = await User.findByIdAndUpdate(
      id,
      {
        ubicacion: {
          type: 'Point',
          coordinates: [longitud, latitud] // GeoJSON: [lng, lat]
        }
      },
      { new: true }
    ).select('-password');

    if (!usuarioActualizado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    console.log(`📍 Ubicación actualizada para ${usuarioActualizado.nombre}: [${longitud}, ${latitud}]`);
    res.json({
      mensaje: 'Ubicación actualizada correctamente',
      usuario: usuarioActualizado.nombre,
      coordenadas: { latitud, longitud }
    });
  } catch (error) {
    console.error('Error actualizando ubicación:', error);
    res.status(500).json({ mensaje: 'Error al actualizar la ubicación' });
  }
});

// --- RUTA: Obtener estudiantes de un curso con su ubicación ---
// GET /api/usuarios/curso/:cursoId/ubicaciones
// Usa $lookup (aggregation) para combinar estudiantes del curso con sus coordenadas.
// El índice 2DSphere en 'ubicacion' hace esta consulta muy eficiente.
router.get('/curso/:cursoId/ubicaciones', async (req, res) => {
  try {
    const Course = require('../models/Course');
    const mongoose = require('mongoose');

    // 1. Obtener el curso con la lista de IDs de estudiantes
    const curso = await Course.findById(req.params.cursoId).select('nombre estudiantes profesor_id');
    if (!curso) {
      return res.status(404).json({ mensaje: 'Curso no encontrado' });
    }

    // 2. Buscar los usuarios correspondientes que tengan ubicación registrada
    //    Usamos $ne para excluir los que tienen coordenadas predeterminadas [0,0]
    const estudiantesConUbicacion = await User.find({
      _id: { $in: curso.estudiantes },
      'ubicacion.coordinates': { $ne: [0, 0] }  // Operador $ne: excluir sin ubicación
    }).select('nombre email rol ubicacion');

    res.json({
      cursoId: req.params.cursoId,
      nombreCurso: curso.nombre,
      totalEstudiantes: curso.estudiantes.length,
      estudiantesConUbicacion: estudiantesConUbicacion.length,
      estudiantes: estudiantesConUbicacion.map(e => ({
        id: e._id,
        nombre: e.nombre,
        email: e.email,
        latitud: e.ubicacion.coordinates[1],   // GeoJSON: [lng, lat] → lat es índice 1
        longitud: e.ubicacion.coordinates[0],  // GeoJSON: [lng, lat] → lng es índice 0
      }))
    });
  } catch (error) {
    console.error('Error obteniendo ubicaciones:', error);
    res.status(500).json({ mensaje: 'Error al obtener ubicaciones de estudiantes' });
  }
});

module.exports = router;
