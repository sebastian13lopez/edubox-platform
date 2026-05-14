const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  sexo: {
    type: String,
    enum: ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir', null],
    default: null
  },
  telefono: {
    type: String,
    trim: true
  },
  tituloProfesional: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  rol: {
    type: String,
    enum: ['admin', 'profesor', 'estudiante'],
    default: 'estudiante'
  },
  estado: {
    type: String,
    enum: ['Pendiente', 'Aprobado', 'Activo'],
    default: function() {
      // Los profesores recién registrados quedan a la espera del Administrador
      return this.rol === 'profesor' ? 'Pendiente' : 'Activo';
    }
  },

  // ── Campo para el Índice Geoespacial ──────────────────────────────
  // Almacena la última ubicación conocida del usuario en formato GeoJSON.
  // Se actualiza automáticamente cuando el usuario inicia sesión.
  // coordinates: [longitud, latitud]  ← MongoDB usa este orden (lng, lat)
  ubicacion: {
    type: {
      type: String,
      enum: ['Point'],   // GeoJSON solo acepta 'Point' para un punto único
      default: 'Point'
    },
    coordinates: {
      type: [Number],    // [longitud, latitud]
      default: [0, 0]    // Coordenadas por defecto (sin ubicación)
    }
  }
}, { 
  timestamps: true // Agrega automáticamente createdAt y updatedAt
});

// ── ÍNDICE 4 — Geoespacial (2DSphere Index):
// Permite consultas geoespaciales eficientes sobre el campo 'ubicacion'.
// Soporta geometrías esféricas (coordenadas reales en la Tierra).
// Habilita operadores como $near, $geoWithin, $geoIntersects.
userSchema.index({ ubicacion: '2dsphere' });

// ── ÍNDICE 5 — Simple (Single Field) en rol:
// Optimiza consultas que filtran usuarios por rol.
// Ej: User.find({ rol: 'profesor' }) en el panel de administración.
userSchema.index({ rol: 1 });

module.exports = mongoose.model('User', userSchema);