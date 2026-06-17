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
    
    // 1. Buscar el usuario a eliminar
    const usuario = await User.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // 2. Restricción de negocio: bloquear eliminación de profesor con cursos activos
    if (usuario.rol === 'profesor') {
      const Course = require('../models/Course');
      const cursoAsociado = await Course.findOne({ profesor_id: id });
      if (cursoAsociado) {
        return res.status(400).json({ 
          error: 'Restricción de negocio',
          mensaje: `No se puede eliminar al docente "${usuario.nombre}" porque tiene cursos asociados (ej. "${cursoAsociado.nombre}").` 
        });
      }
    }

    // 3. Proceder con la eliminación si pasa las validaciones
    await User.findByIdAndDelete(id);
    res.json({ mensaje: 'Usuario eliminado del sistema' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error interno al intentar eliminar usuario' });
  }
});

// --- RUTA: Actualizar datos de un usuario (sexo, estado, etc.) ---
// PUT /api/usuarios/:id
// Permite al admin actualizar campos como sexo de estudiantes existentes.
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const camposPermitidos = ['sexo', 'estado', 'nombre', 'telefono', 'tituloProfesional'];
    const actualizacion = {};
    camposPermitidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        actualizacion[campo] = req.body[campo];
      }
    });

    const usuarioActualizado = await User.findByIdAndUpdate(
      id,
      { $set: actualizacion },
      { new: true, runValidators: true }
    ).select('-password');

    if (!usuarioActualizado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json(usuarioActualizado);
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el usuario' });
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

// ─────────────────────────────────────────────────────────────
// ESTADÍSTICAS PARA EL DASHBOARD DEL ADMINISTRADOR
// ─────────────────────────────────────────────────────────────

// --- RUTA: Cantidad de estudiantes por sexo ---
// GET /api/usuarios/stats/por-sexo
// Usa aggregation pipeline con $match + $group para contar por campo 'sexo'.
router.get('/stats/por-sexo', async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { rol: 'estudiante' } },                     // Filtrar solo estudiantes
      { $group: { _id: '$sexo', total: { $sum: 1 } } },      // Agrupar por sexo
      { $sort: { total: -1 } }                               // Ordenar de mayor a menor
    ]);

    // Normalizar: asegurar que existan todas las categorías (aunque sean 0)
    const mapa = { Masculino: 0, Femenino: 0, Otro: 0, 'Prefiero no decir': 0, 'Sin especificar': 0 };
    stats.forEach(s => {
      const clave = s._id || 'Sin especificar';
      mapa[clave] = s.total;
    });

    res.json(mapa);
  } catch (error) {
    console.error('Error obteniendo stats por sexo:', error);
    res.status(500).json({ mensaje: 'Error al obtener estadísticas por sexo' });
  }
});

// --- RUTA: Actividad de estudiantes por hora del día (hoy) ---
// GET /api/usuarios/stats/actividad-dia
// Usa $hour de MongoDB para extraer la hora de 'updatedAt' y contar actividad.
// Si no hay datos de hoy, devuelve datos de toda la semana agrupados por hora.
router.get('/stats/actividad-dia', async (req, res) => {
  try {
    // Inicio y fin del día actual (UTC)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    let stats = await User.aggregate([
      {
        $match: {
          rol: 'estudiante',
          updatedAt: { $gte: hoy, $lt: manana }   // Operador $gte y $lt para rango del día
        }
      },
      {
        $group: {
          _id: { $hour: '$updatedAt' },            // Extraer la hora (0-23)
          total: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Si no hay datos de hoy, usar la semana completa para mostrar el patrón
    if (stats.length === 0) {
      const hace7dias = new Date(hoy);
      hace7dias.setDate(hace7dias.getDate() - 7);

      stats = await User.aggregate([
        {
          $match: {
            rol: 'estudiante',
            updatedAt: { $gte: hace7dias }         // Última semana si no hay datos hoy
          }
        },
        {
          $group: {
            _id: { $hour: '$updatedAt' },
            total: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]);
    }

    // Construir arreglo de 24 horas (índice = hora del día)
    const horasPorHora = Array(24).fill(0);
    stats.forEach(s => { horasPorHora[s._id] = s.total; });

    res.json(horasPorHora);
  } catch (error) {
    console.error('Error obteniendo actividad del día:', error);
    res.status(500).json({ mensaje: 'Error al obtener actividad del día' });
  }
});

module.exports = router;

