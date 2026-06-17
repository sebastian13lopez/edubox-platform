const mongoose = require('mongoose');

// ══════════════════════════════════════════════════════════════
// COLECCIÓN 1: PQRS
// Almacena el registro principal de cada solicitud.
// Tipos: Petición, Queja, Reclamo, Sugerencia
// ══════════════════════════════════════════════════════════════
const pqrsSchema = new mongoose.Schema({
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tipo: {
    type: String,
    required: true,
    enum: ['Petición', 'Queja', 'Reclamo', 'Sugerencia']
  },
  asunto: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  estado: {
    type: String,
    enum: ['Pendiente', 'En revisión', 'Respondida', 'Cerrada'],
    default: 'Pendiente'
  },
  // Número de radicado único generado al crear la PQRS
  radicado: {
    type: String,
    unique: true
  }
}, { timestamps: true });

// ── ÍNDICE 1 — Compuesto: filtrar por usuario y ordenar por fecha
pqrsSchema.index({ usuario_id: 1, createdAt: -1 });

// ── ÍNDICE 2 — Partial: solo las PQRS pendientes o en revisión
// Reduce el tamaño del índice ignorando las ya cerradas
pqrsSchema.index(
  { estado: 1, createdAt: -1 },
  { partialFilterExpression: { estado: { $in: ['Pendiente', 'En revisión'] } } }
);

// ── ÍNDICE 3 — Text Search: búsqueda en asunto y descripción
pqrsSchema.index({ asunto: 'text', descripcion: 'text' });

// Generar radicado automático antes de guardar
pqrsSchema.pre('save', async function () {
  if (!this.radicado) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.radicado = `PQRS-${ts}-${rand}`;
  }
});

module.exports = mongoose.model('PQRS', pqrsSchema);
