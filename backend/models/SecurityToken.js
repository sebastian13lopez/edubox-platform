const mongoose = require('mongoose');

const securityTokenSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  token: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    expires: 3600 // TTL Index: Se elimina en 3600 segundos (1 hora)
  }
});

module.exports = mongoose.model('SecurityToken', securityTokenSchema);
