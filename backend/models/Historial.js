const mongoose = require('mongoose');

const HistorialSchema = new mongoose.Schema({
  curso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  profesor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  textoCompleto: { type: String, required: true },
  duracion: { type: Number, default: 0 }, // duración total de la clase en segundos
  ausentes: [{ type: String }], // listado de estudiantes que no asistieron
  metricasParticipacion: [{
    nombre: { type: String },
    mensajesCount: { type: Number, default: 0 },
    preguntas: [{ type: String }]
  }],
  geolocalizaciones: [{
    nombre: { type: String },
    rol: { type: String },
    coordenadas: { type: [Number], default: [0, 0] }, // [longitud, latitud]
    ip: { type: String, default: '127.0.0.1' }
  }],
  estadisticas: {
    palabras: { type: Number, default: 0 }
  },
  participantes: [{ type: String }],
  fecha: { type: Date, default: Date.now }
}, { timestamps: true });

// 1. Índice de Texto: Para búsquedas súper rápidas dentro de las transcripciones de la clase
HistorialSchema.index({ textoCompleto: 'text' });

// 2. Índice Compuesto: Optimiza las consultas que filtran por curso y ordenan por fecha
HistorialSchema.index({ curso_id: 1, fecha: -1 });

module.exports = mongoose.model('Historial', HistorialSchema);
