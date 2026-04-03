const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    default: () => 'TKT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase()
  },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  category: {
    type: String,
    enum: ['Billing', 'Technical', 'Account', 'General', 'Security'],
    default: 'General'
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  summary: { type: String, default: '' },
  emotion: {
    type: String,
    enum: ['Angry', 'Frustrated', 'Desperate', 'Threatening', 'Calm'],
    default: 'Calm'
  },
  urgency: {
    type: String,
    enum: ['Immediate', 'High', 'Medium', 'Low'],
    default: 'Medium'
  },
  transcript: [{
    role: { type: String, enum: ['user', 'bot'] },
    message: { type: String },
    content: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open'
  },
  assignedAgent: { type: String, default: null },
  securityFlag: { type: Boolean, default: false },
  resolutionNotes: { type: String, default: '' },
  agentBriefing: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
