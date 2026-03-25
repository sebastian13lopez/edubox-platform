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
module.exports = router;
