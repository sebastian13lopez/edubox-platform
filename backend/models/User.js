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
  }
}, { 
  timestamps: true // Agrega automáticamente createdAt y updatedAt
});

module.exports = mongoose.model('User', userSchema);