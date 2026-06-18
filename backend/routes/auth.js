const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const SecurityToken = require('../models/SecurityToken');

// ── Transporter de Nodemailer (creado bajo demanda para no fallar al importar) ─
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

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

// --- RUTA 3: Solicitar recuperación de contraseña ---
// Recibe el correo, genera un token seguro, lo guarda en SecurityToken y
// envía un correo con el enlace de restablecimiento.
router.post('/forgot-password', async (req, res) => {
  try {
    const { correo } = req.body;
    const email = correo?.toLowerCase()?.trim();

    if (!email) {
      return res.status(400).json({ mensaje: 'El correo es requerido' });
    }

    // 1. Buscar el usuario (respondemos igual si no existe para evitar enumeración)
    const usuario = await User.findOne({ email });
    if (!usuario) {
      // Por seguridad, no revelamos si el correo existe o no
      return res.status(200).json({ mensaje: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' });
    }

    // 2. Eliminar tokens previos de este usuario (si existían)
    await SecurityToken.deleteMany({ user_id: usuario._id });

    // 3. Generar token criptográficamente seguro (32 bytes → 64 chars hex)
    const tokenRaw = crypto.randomBytes(32).toString('hex');

    // 4. Guardar el token en la base de datos (expira en 1 hora por el TTL index)
    await new SecurityToken({ user_id: usuario._id, token: tokenRaw }).save();

    // 5. Construir el enlace de restablecimiento
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const enlace = `${frontendUrl}/reset-password?token=${tokenRaw}`;

    // 6. Enviar el correo con el enlace
    await getTransporter().sendMail({
      from: `"Eduvox 🎓" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Restablece tu contraseña – Eduvox',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 40px 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">🎓 Eduvox</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">Plataforma de Aprendizaje Virtual</p>
          </div>

          <!-- Cuerpo -->
          <div style="padding: 40px 32px;">
            <h2 style="color: #1e293b; font-size: 22px; font-weight: 700; margin: 0 0 12px;">Hola, ${usuario.nombre} 👋</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta en Eduvox. 
              Haz clic en el botón de abajo para crear una nueva contraseña. Este enlace es válido por <strong>1 hora</strong>.
            </p>

            <!-- Botón CTA -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${enlace}"
                style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #06b6d4); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 15px rgba(124,58,237,0.4);">
                🔑 Restablecer Contraseña
              </a>
            </div>

            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
              Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña seguirá siendo la misma.<br><br>
              También puedes copiar y pegar el siguiente enlace en tu navegador:<br>
              <a href="${enlace}" style="color: #7c3aed; word-break: break-all;">${enlace}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #f1f5f9; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Eduvox — Todos los derechos reservados</p>
          </div>
        </div>
      `
    });

    res.status(200).json({ mensaje: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' });

  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({ mensaje: 'Hubo un error al procesar la solicitud. Inténtalo de nuevo.' });
  }
});

// --- RUTA 4: Restablecer la contraseña con el token del correo ---
// Valida el token, actualiza la contraseña y elimina el token usado.
router.post('/reset-password', async (req, res) => {
  try {
    const { token, nuevaPassword } = req.body;

    if (!token || !nuevaPassword) {
      return res.status(400).json({ mensaje: 'El token y la nueva contraseña son requeridos.' });
    }

    if (nuevaPassword.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // 1. Buscar el token en la base de datos
    const securityToken = await SecurityToken.findOne({ token });
    if (!securityToken) {
      return res.status(400).json({ mensaje: 'El enlace no es válido o ha expirado. Solicita uno nuevo.' });
    }

    // 2. Buscar el usuario asociado
    const usuario = await User.findById(securityToken.user_id);
    if (!usuario) {
      return res.status(400).json({ mensaje: 'Usuario no encontrado.' });
    }

    // 3. Encriptar la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    usuario.password = await bcrypt.hash(nuevaPassword, salt);
    await usuario.save();

    // 4. Eliminar el token ya utilizado para que no se pueda reutilizar
    await SecurityToken.deleteOne({ _id: securityToken._id });

    res.status(200).json({ mensaje: '¡Contraseña restablecida exitosamente! Ya puedes iniciar sesión.' });

  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({ mensaje: 'Hubo un error al restablecer la contraseña.' });
  }
});

module.exports = router;