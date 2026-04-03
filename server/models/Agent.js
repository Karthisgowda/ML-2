const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true } // bcrypt hashed
}, { timestamps: true });

module.exports = mongoose.model('Agent', agentSchema);
