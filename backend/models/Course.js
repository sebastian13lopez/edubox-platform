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

// ── ÍNDICE 1 — Parcial (Partial Index):
// Solo indexa documentos donde en_vivo es true.
// Reduce el tamaño del índice al ignorar los cursos inactivos.
courseSchema.index({ en_vivo: 1 }, { partialFilterExpression: { en_vivo: true } });

// ── ÍNDICE 2 — Multikey Index:
// MongoDB crea automáticamente un Multikey Index cuando el campo indexado
// es un array. Aquí 'estudiantes' es un array de ObjectIds, por lo que
// MongoDB indexa cada elemento del array individualmente.
// Optimiza búsquedas del tipo: Course.find({ estudiantes: estudianteId })
courseSchema.index({ estudiantes: 1 });

// ── ÍNDICE 3 — Simple (Single Field) en profesor_id:
// Optimiza las consultas que filtran cursos por profesor.
// Ej: Course.find({ profesor_id: id }) en el dashboard del profesor.
courseSchema.index({ profesor_id: 1 });

module.exports = mongoose.model('Course', courseSchema);
