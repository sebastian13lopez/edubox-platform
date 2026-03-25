const mongoose = require('mongoose');

const HistorialSchema = new mongoose.Schema({
  curso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', required: true },
  profesor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  textoCompleto: { type: String, required: true },
  estadisticas: {
    palabras: { type: Number, default: 0 }
  },
  participantes: [{ type: String }],
  fecha: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Historial', HistorialSchema);
