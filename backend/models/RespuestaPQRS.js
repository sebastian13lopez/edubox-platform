const mongoose = require('mongoose');

// ══════════════════════════════════════════════════════════════
// COLECCIÓN 2: Respuestas_PQRS
// Contiene las contestaciones del Administrador a cada solicitud.
// Una PQRS puede tener una sola respuesta oficial.
// ══════════════════════════════════════════════════════════════
const respuestaPQRSSchema = new mongoose.Schema({
  pqrs_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PQRS',
    required: true,
    unique: true  // Una sola respuesta por PQRS
  },
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contenido: {
    type: String,
    required: true,
    trim: true
  },
  // correoEnviado indica si el PDF fue enviado exitosamente
  correoEnviado: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('RespuestaPQRS', respuestaPQRSSchema);
