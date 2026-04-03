const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  messages: [{
    role: { type: String, enum: ['user', 'bot', 'agent', 'system'] },
    content: { type: String },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
