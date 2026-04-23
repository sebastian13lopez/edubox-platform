const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // NUEVO: Herramienta para los tokens
const User = require('../models/User');

// --- RUTA 1: Registrar un nuevo usuario ---
router.post('/register', async (req, res) => {
  try {
    const { nombre, correo, password, rol, telefono, tituloProfesional } = req.body;

    const email = correo; // Adaptando del frontend 'correo' al backend 'email'
    const rolNormalizado = rol ? rol.toLowerCase() : 'estudiante';

    let usuario = await User.findOne({ email });
    if (usuario) {
      return res.status(400).json({ mensaje: 'El correo ya está registrado' });
    }

    usuario = new User({ nombre, email, password, rol: rolNormalizado, telefono, tituloProfesional });

    const salt = await bcrypt.genSalt(10);
    usuario.password = await bcrypt.hash(password, salt);

    await usuario.save();
    res.status(201).json({ mensaje: 'Usuario registrado exitosamente', rol: usuario.rol, id: usuario.id });

  } catch (error) {
    console.error(error);
    // Captura el error de índice único de MongoDB (ej. correo duplicado)
    if (error.code === 11000) {
      return res.status(400).json({ mensaje: 'Este correo ya se encuentra registrado' });
    }
    res.status(500).json({ mensaje: 'Hubo un error en el servidor' });
  }
});

// --- RUTA 2: Iniciar Sesión (Login) ---
router.post('/login', async (req, res) => {
  try {
    const { correo, password } = req.body;
    const email = correo;

    // 1. Verificar si el correo existe
    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ mensaje: 'Correo o contraseña incorrectos' });
    }

    // 2. Verificar que la contraseña coincida
    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(400).json({ mensaje: 'Correo o contraseña incorrectos' });
    }

    // 3. Crear la "pulsera VIP" (Token JWT)
    const payload = {
      usuario: {
        id: usuario.id,
        rol: usuario.rol
      }
    };

    // Firmar el token
    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secreto_super_seguro_voxera_123', // Llave secreta
      { expiresIn: '2h' }, // El token caduca en 2 horas por seguridad
      (error, token) => {
        if (error) throw error;
        // Si todo sale bien, devolvemos el token, id, rol, nombre y ESTADO
        res.json({ token, id: usuario.id, rol: usuario.rol, nombre: usuario.nombre, estado: usuario.estado });
      }
    );

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Hubo un error en el servidor' });
  }
});

module.exports = router;