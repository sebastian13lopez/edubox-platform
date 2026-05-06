const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  estudiante_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clase_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  tipo_evento: {
    type: String,
    required: true,
    enum: ['tab_focus_lost', 'quiz_answered_correct', 'quiz_answered_incorrect', 'chat_participation', 'tiempo_clase', 'confusion_reported']
  },
  valor: {
    type: Number,
    default: 0
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

// Índice Compuesto: para optimizar las consultas del dashboard del profesor
// que filtra por clase y ordena/filtra por fecha
activityLogSchema.index({ clase_id: 1, fecha: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
