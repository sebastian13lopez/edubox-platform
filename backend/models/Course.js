const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  descripcion: {
    type: String
  },
  // Referencia a UN profesor
  profesor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Referencia a MUCHOS estudiantes (Array)
  estudiantes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Materiales de la clase
  materiales: [{
    titulo: { type: String, required: true },
    descripcion: { type: String },
    url: { type: String },
    fecha: { type: Date, default: Date.now }
  }],
  // Nuevo campo para saber si la clase está transcurriendo en este momento
  en_vivo: { 
    type: Boolean, 
    default: false 
  }
}, {
  timestamps: true
});

// Índice Parcial: Solo indexa documentos donde en_vivo es true.
courseSchema.index({ en_vivo: 1 }, { partialFilterExpression: { en_vivo: true } });

module.exports = mongoose.model('Course', courseSchema);
