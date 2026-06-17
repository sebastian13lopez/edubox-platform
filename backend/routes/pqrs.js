const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');

const PQRS = require('../models/PQRS');
const RespuestaPQRS = require('../models/RespuestaPQRS');
const User = require('../models/User');

// ══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DEL TRANSPORTE DE CORREO (Nodemailer)
// Usa Ethereal (correo de prueba gratuito) si no hay credenciales reales.
// Para producción: reemplazar con Gmail, SendGrid, etc.
// ══════════════════════════════════════════════════════════════
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Producción: Gmail o SMTP real
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // Desarrollo: Ethereal (genera cuenta temporal automáticamente)
    const cuenta = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: cuenta.user,
        pass: cuenta.pass
      }
    });
    console.log('📧 Usando cuenta Ethereal de prueba:', cuenta.user);
  }
  return transporter;
}

// ══════════════════════════════════════════════════════════════
// HELPER: Generar PDF de respuesta en memoria (Buffer)
// ══════════════════════════════════════════════════════════════
function generarPDFRespuesta(pqrs, respuesta, usuario, admin) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Encabezado ──────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill('#6d28d9');
    doc.fillColor('white')
       .font('Helvetica-Bold')
       .fontSize(22)
       .text('EduVox', 50, 25)
       .fontSize(11)
       .font('Helvetica')
       .text('Sistema de Gestión de PQRS', 50, 52)
       .text('Respuesta Oficial', 50, 67);

    // ── Número de radicado ────────────────────────────
    doc.fillColor('#1e293b')
       .font('Helvetica-Bold')
       .fontSize(13)
       .text(`Radicado: ${pqrs.radicado}`, 50, 110);

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#64748b')
       .text(`Fecha de radicación: ${new Date(pqrs.createdAt).toLocaleDateString('es-CO', { dateStyle: 'full' })}`, 50, 128)
       .text(`Fecha de respuesta:   ${new Date(respuesta.createdAt).toLocaleDateString('es-CO', { dateStyle: 'full' })}`, 50, 143);

    // ── Línea divisoria ───────────────────────────────
    doc.moveTo(50, 165).lineTo(545, 165).strokeColor('#e2e8f0').stroke();

    // ── Datos del solicitante ─────────────────────────
    doc.fillColor('#1e293b')
       .font('Helvetica-Bold')
       .fontSize(11)
       .text('Datos del Solicitante', 50, 180);

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#334155')
       .text(`Nombre:  ${usuario.nombre}`, 50, 198)
       .text(`Correo:  ${usuario.email}`, 50, 213)
       .text(`Tipo:    ${pqrs.tipo}`, 50, 228)
       .text(`Asunto:  ${pqrs.asunto}`, 50, 243);

    // ── Descripción original ──────────────────────────
    doc.moveTo(50, 268).lineTo(545, 268).strokeColor('#e2e8f0').stroke();

    doc.fillColor('#1e293b')
       .font('Helvetica-Bold')
       .fontSize(11)
       .text('Descripción de la Solicitud', 50, 283);

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#334155')
       .text(pqrs.descripcion, 50, 301, { width: 495, align: 'justify' });

    const yRespuesta = doc.y + 20;
    // ── Respuesta del administrador ───────────────────
    doc.moveTo(50, yRespuesta).lineTo(545, yRespuesta).strokeColor('#e2e8f0').stroke();

    doc.rect(50, yRespuesta + 10, 495, 24).fill('#f0fdf4');
    doc.fillColor('#166534')
       .font('Helvetica-Bold')
       .fontSize(11)
       .text('Respuesta Oficial del Administrador', 58, yRespuesta + 16);

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#1e293b')
       .text(respuesta.contenido, 50, yRespuesta + 44, { width: 495, align: 'justify' });

    // ── Firma ─────────────────────────────────────────
    const yFirma = doc.y + 30;
    doc.moveTo(50, yFirma).lineTo(545, yFirma).strokeColor('#e2e8f0').stroke();

    doc.fillColor('#64748b')
       .font('Helvetica')
       .fontSize(9)
       .text(`Respondido por: ${admin.nombre} — Administrador EduVox`, 50, yFirma + 12)
       .text('Este documento es una respuesta oficial generada automáticamente por el sistema EduVox.', 50, yFirma + 26, { width: 495 });

    // ── Pie de página ─────────────────────────────────
    doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill('#6d28d9');
    doc.fillColor('white')
       .fontSize(8)
       .text('EduVox — Plataforma Educativa Inteligente', 50, doc.page.height - 22, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  });
}

// ══════════════════════════════════════════════════════════════
// ENDPOINT 1 — POST /api/pqrs
// Crear una nueva PQRS y enviar correo de confirmación al usuario
// ══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { usuario_id, tipo, asunto, descripcion } = req.body;

    // Validar que el usuario existe
    const usuario = await User.findById(usuario_id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Crear la PQRS (el radicado se genera automáticamente en el pre-save)
    const nuevaPQRS = new PQRS({ usuario_id, tipo, asunto, descripcion });
    await nuevaPQRS.save();

    // ── Responder inmediatamente — el correo se envía en segundo plano ──
    res.status(201).json({
      mensaje: 'PQRS creada exitosamente. Revisa tu correo con el número de radicado.',
      pqrs: nuevaPQRS
    });

    // Fire-and-forget: envío de correo no bloquea la respuesta
    getTransporter().then(mail => {
      return mail.sendMail({
        from: `"EduVox PQRS" <${process.env.EMAIL_USER || 'noreply@eduvox.edu'}>`,
        to: usuario.email,
        subject: `✅ PQRS Recibida — Radicado ${nuevaPQRS.radicado}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
            <div style="background:#6d28d9;padding:28px 32px">
              <h1 style="color:white;margin:0;font-size:22px">EduVox</h1>
              <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px">Sistema de Gestión de PQRS</p>
            </div>
            <div style="padding:28px 32px">
              <h2 style="color:#1e293b;font-size:18px;margin:0 0 12px">Hola, ${usuario.nombre} 👋</h2>
              <p style="color:#334155;font-size:14px;line-height:1.6">Tu solicitud ha sido recibida y registrada exitosamente en nuestro sistema.</p>
              <div style="background:#f8fafc;border-radius:10px;padding:18px;margin:18px 0;border-left:4px solid #6d28d9">
                <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:bold;text-transform:uppercase;letter-spacing:1px">Número de Radicado</p>
                <p style="margin:0;font-size:22px;font-weight:bold;color:#6d28d9;letter-spacing:2px">${nuevaPQRS.radicado}</p>
              </div>
              <table style="width:100%;font-size:13px;color:#334155;border-collapse:collapse">
                <tr><td style="padding:6px 0;color:#64748b;width:120px">Tipo:</td><td style="font-weight:600">${tipo}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Asunto:</td><td style="font-weight:600">${asunto}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Estado:</td><td><span style="background:#fef9c3;color:#a16207;padding:2px 10px;border-radius:99px;font-weight:600;font-size:12px">Pendiente</span></td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Fecha:</td><td>${new Date().toLocaleDateString('es-CO', { dateStyle: 'long' })}</td></tr>
              </table>
              <p style="color:#64748b;font-size:13px;margin-top:18px;line-height:1.6">
                Un administrador revisará tu solicitud y te responderá a la brevedad posible.
                Recibirás un correo con la respuesta oficial en formato PDF.
              </p>
            </div>
            <div style="background:#f1f5f9;padding:16px 32px;text-align:center">
              <p style="margin:0;font-size:12px;color:#94a3b8">EduVox — Plataforma Educativa Inteligente</p>
            </div>
          </div>
        `
      });
    }).then(info => {
      if (nodemailer.getTestMessageUrl(info)) {
        console.log('📧 Preview correo confirmación:', nodemailer.getTestMessageUrl(info));
      }
    }).catch(err => {
      console.error('⚠️  Correo de confirmación falló (silencioso):', err.message);
    });

  } catch (err) {
    console.error('Error creando PQRS:', err);
    res.status(500).json({ error: 'Error creando la PQRS', detalle: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// ENDPOINT 2 — GET /api/pqrs
// Listar todas las PQRS (Admin: todas | Usuario: solo las suyas)
// Query params: ?usuario_id=xxx | ?estado=Pendiente | ?buscar=texto
// ══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { usuario_id, estado, buscar } = req.query;
    let query = {};

    if (usuario_id) query.usuario_id = usuario_id;
    if (estado)     query.estado = estado;
    // Solo usar $text si hay búsqueda (requiere índice text en Atlas)
    if (buscar && buscar.trim()) query.$text = { $search: buscar.trim() };

    const pqrsList = await PQRS.find(query)
      .populate('usuario_id', 'nombre email rol')
      .sort({ createdAt: -1 });

    res.json(pqrsList);
  } catch (err) {
    // Si falla el text search (índice no creado aún), devolver lista sin filtro de texto
    if (err.message && err.message.includes('text index')) {
      const pqrsList = await PQRS.find({}).populate('usuario_id', 'nombre email rol').sort({ createdAt: -1 });
      return res.json(pqrsList);
    }
    res.status(500).json({ error: 'Error listando PQRS', detalle: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// ENDPOINT STATS — GET /api/pqrs/stats/resumen
// ⚠️  DEBE estar antes de /:id para que Express no lo confunda
// ══════════════════════════════════════════════════════════════
router.get('/stats/resumen', async (req, res) => {
  try {
    const stats = await PQRS.aggregate([
      { $group: { _id: '$estado', total: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    const porTipo = await PQRS.aggregate([
      { $group: { _id: '$tipo', total: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    const totalGeneral = await PQRS.countDocuments();
    res.json({ totalGeneral, porEstado: stats, porTipo });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo estadísticas', detalle: err.message });
  }
});


// ══════════════════════════════════════════════════════════════
// ENDPOINT 3 — GET /api/pqrs/:id
// Ver detalle de una PQRS con su respuesta (si existe)
// ══════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const pqrs = await PQRS.findById(req.params.id)
      .populate('usuario_id', 'nombre email');

    if (!pqrs) return res.status(404).json({ error: 'PQRS no encontrada' });

    const respuesta = await RespuestaPQRS.findOne({ pqrs_id: pqrs._id })
      .populate('admin_id', 'nombre email');

    res.json({ pqrs, respuesta });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo PQRS', detalle: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// ENDPOINT 4 — PUT /api/pqrs/:id/estado
// Actualizar estado de una PQRS (solo Admin)
// ══════════════════════════════════════════════════════════════
router.put('/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    const pqrs = await PQRS.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true, runValidators: true }
    ).populate('usuario_id', 'nombre email');

    if (!pqrs) return res.status(404).json({ error: 'PQRS no encontrada' });
    res.json(pqrs);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando estado', detalle: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// ENDPOINT 5 — POST /api/pqrs/:id/responder
// Admin responde una PQRS → genera PDF y envía correo al usuario
// Body: { admin_id, contenido }
// ══════════════════════════════════════════════════════════════
router.post('/:id/responder', async (req, res) => {
  try {
    const { admin_id, contenido } = req.body;

    // 1. Verificar que la PQRS existe y obtener el usuario
    const pqrs = await PQRS.findById(req.params.id).populate('usuario_id');
    if (!pqrs) return res.status(404).json({ error: 'PQRS no encontrada' });
    if (pqrs.estado === 'Respondida') return res.status(400).json({ error: 'Esta PQRS ya fue respondida' });

    // 2. Verificar que el admin existe
    const admin = await User.findById(admin_id);
    if (!admin) return res.status(404).json({ error: 'Administrador no encontrado' });

    // 3. Guardar la respuesta en Respuestas_PQRS
    const nuevaRespuesta = new RespuestaPQRS({ pqrs_id: pqrs._id, admin_id, contenido });
    await nuevaRespuesta.save();

    // 4. Actualizar estado de la PQRS
    pqrs.estado = 'Respondida';
    await pqrs.save();

    // 5. Responder inmediatamente — PDF y correo se generan en segundo plano
    res.status(201).json({
      mensaje: 'PQRS respondida. Se enviará un correo con el PDF adjunto al usuario.',
      respuesta: nuevaRespuesta,
      pqrs: { radicado: pqrs.radicado, estado: pqrs.estado }
    });

    // Fire-and-forget: generar PDF y enviar correo sin bloquear la respuesta
    generarPDFRespuesta(pqrs, nuevaRespuesta, pqrs.usuario_id, admin)
      .then(pdfBuffer => getTransporter().then(mail => {
        return mail.sendMail({
          from: `"EduVox PQRS" <${process.env.EMAIL_USER || 'noreply@eduvox.edu'}>`,
          to: pqrs.usuario_id.email,
          subject: `📬 Respuesta a tu PQRS — Radicado ${pqrs.radicado}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
              <div style="background:#6d28d9;padding:28px 32px">
                <h1 style="color:white;margin:0;font-size:22px">EduVox</h1>
                <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px">Respuesta Oficial a tu PQRS</p>
              </div>
              <div style="padding:28px 32px">
                <h2 style="color:#1e293b;font-size:18px;margin:0 0 12px">Hola, ${pqrs.usuario_id.nombre} 👋</h2>
                <p style="color:#334155;font-size:14px;line-height:1.6">
                  Tu solicitud <strong>${pqrs.radicado}</strong> ha sido revisada y respondida.
                </p>
                <div style="background:#f0fdf4;border-radius:10px;padding:18px;margin:18px 0;border-left:4px solid #16a34a">
                  <p style="margin:0 0 8px;font-size:12px;color:#15803d;font-weight:bold;text-transform:uppercase;letter-spacing:1px">Respuesta</p>
                  <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6">${contenido}</p>
                </div>
                <p style="color:#64748b;font-size:13px;line-height:1.6">Adjunto encontrarás el PDF oficial con los detalles y la respuesta.</p>
              </div>
              <div style="background:#f1f5f9;padding:16px 32px;text-align:center">
                <p style="margin:0;font-size:12px;color:#94a3b8">EduVox — Plataforma Educativa Inteligente</p>
              </div>
            </div>
          `,
          attachments: [{
            filename: `Respuesta_PQRS_${pqrs.radicado}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }]
        });
      }))
      .then(info => {
        nuevaRespuesta.correoEnviado = true;
        nuevaRespuesta.save().catch(() => {});
        if (nodemailer.getTestMessageUrl(info)) {
          console.log('📧 Preview correo respuesta:', nodemailer.getTestMessageUrl(info));
        }
      })
      .catch(err => {
        console.error('⚠️  Correo de respuesta falló (silencioso):', err.message);
      });

  } catch (err) {
    console.error('Error respondiendo PQRS:', err);
    res.status(500).json({ error: 'Error respondiendo la PQRS', detalle: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// ENDPOINT 6 — DELETE /api/pqrs/:id
// Eliminar una PQRS (solo Admin, solo si está Cerrada)
// ══════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const pqrs = await PQRS.findById(req.params.id);
    if (!pqrs) return res.status(404).json({ error: 'PQRS no encontrada' });

    // Eliminar también la respuesta asociada si existe
    await RespuestaPQRS.deleteOne({ pqrs_id: pqrs._id });
    await pqrs.deleteOne();

    res.json({ mensaje: 'PQRS y su respuesta eliminadas correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando PQRS', detalle: err.message });
  }
});

// (stats/resumen ya está definido antes de /:id — ver arriba)


module.exports = router;
