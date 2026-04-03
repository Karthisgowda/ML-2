const express = require('express');
const Ticket = require('../models/Ticket');
const authMiddleware = require('../middleware/auth');
const mongoose = require('mongoose');
const memoryStore = require('../services/memoryStore');

const router = express.Router();

function hasDb() {
  return mongoose.connection.readyState === 1;
}

router.get('/user/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    if (!hasDb()) {
      return res.json(memoryStore.listTicketsByEmail(email));
    }

    const tickets = await Ticket.find({ userEmail: email })
      .sort({ createdAt: -1 })
      .select('ticketId category severity status summary assignedAgent emotion urgency createdAt updatedAt');
    res.json(tickets);
  } catch (error) {
    console.error('User tickets error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/user/:id/cancel', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    if (!hasDb()) {
      const ticket = memoryStore.findTicket(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
      if (ticket.userEmail !== email) return res.status(403).json({ error: 'Not your ticket.' });
      if (['closed', 'resolved'].includes(ticket.status)) return res.status(400).json({ error: 'Ticket already ' + ticket.status + '.' });

      const updated = memoryStore.updateTicket(req.params.id, { status: 'closed', resolutionNotes: 'Cancelled by user' });
      const io = req.app.get('io');
      if (io) io.to('agents').emit('ticket_updated', updated);
      return res.json({ ticket: updated });
    }

    let ticket = await Ticket.findById(req.params.id).catch(() => null);
    if (!ticket) ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    if (ticket.userEmail !== email) return res.status(403).json({ error: 'Not your ticket.' });
    if (['closed', 'resolved'].includes(ticket.status)) return res.status(400).json({ error: 'Ticket already ' + ticket.status + '.' });

    ticket.status = 'closed';
    ticket.resolutionNotes = 'Cancelled by user';
    await ticket.save();

    const io = req.app.get('io');
    if (io) io.to('agents').emit('ticket_updated', {
      _id: ticket._id, ticketId: ticket.ticketId,
      status: ticket.status, resolutionNotes: ticket.resolutionNotes
    });

    res.json({ ticket });
  } catch (error) {
    console.error('Cancel ticket error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { status, severity, category, emotion, urgency } = req.query;

    if (!hasDb()) {
      let tickets = memoryStore.listTickets();
      if (status) tickets = tickets.filter((t) => t.status === status);
      if (severity) tickets = tickets.filter((t) => t.severity === severity);
      if (category) tickets = tickets.filter((t) => t.category === category);
      if (emotion) tickets = tickets.filter((t) => t.emotion === emotion);
      if (urgency) tickets = tickets.filter((t) => t.urgency === urgency);
      return res.json(tickets);
    }

    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (category) filter.category = category;
    if (emotion) filter.emotion = emotion;
    if (urgency) filter.urgency = urgency;

    const tickets = await Ticket.find(filter).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/stats/overview', async (req, res) => {
  try {
    if (!hasDb()) {
      const tickets = memoryStore.listTickets();
      return res.json({
        total: tickets.length,
        open: tickets.filter((t) => t.status === 'open').length,
        inProgress: tickets.filter((t) => t.status === 'in-progress').length,
        resolved: tickets.filter((t) => t.status === 'resolved').length,
        highPriority: tickets.filter((t) => ['High', 'Critical'].includes(t.severity)).length,
        flagged: tickets.filter((t) => t.securityFlag).length,
      });
    }

    const [total, open, inProgress, resolved, highPriority, flagged] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: 'open' }),
      Ticket.countDocuments({ status: 'in-progress' }),
      Ticket.countDocuments({ status: 'resolved' }),
      Ticket.countDocuments({ severity: { $in: ['High', 'Critical'] } }),
      Ticket.countDocuments({ securityFlag: true }),
    ]);

    res.json({ total, open, inProgress, resolved, highPriority, flagged });
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/suggestion/:id', async (req, res) => {
  let ticket;
  try {
    if (!hasDb()) {
      ticket = memoryStore.findTicket(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
      return res.json({
        suggestedResolution: 'Review the ticket summary and latest customer message, then respond with the next corrective step.',
        estimatedTime: '5-15 minutes',
        priority: ticket.severity || 'Medium',
        tips: 'Ask for one missing detail at a time and acknowledge the customer emotion first.',
      });
    }

    ticket = await Ticket.findById(req.params.id).catch(() => null);
    if (!ticket) ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    const transcriptText = ticket.transcript
      .map(t => `${t.role === 'user' ? 'Customer' : 'Bot'}: ${t.message || t.content || ''}`)
      .join('\n');

    const prompt = `You are a senior customer support agent. Based on the following support ticket, provide a suggested resolution.\n\nTicket Details:\n- Category: ${ticket.category}\n- Severity: ${ticket.severity}\n- Customer Emotion: ${ticket.emotion}\n- Urgency: ${ticket.urgency}\n- Summary: ${ticket.summary}\n- Security Flagged: ${ticket.securityFlag ? 'YES' : 'No'}\n\nChat Transcript:\n${transcriptText}\n\nProvide your response as JSON ONLY (no markdown, no code fences):\n{\n  "suggestedResolution": "step-by-step resolution for the agent to follow",\n  "estimatedTime": "estimated time to resolve",\n  "priority": "how urgently this should be handled",\n  "tips": "any tips for the agent handling this case"\n}`;

    let responseText;
    if (process.env.GROQ_API_KEY) {
      try {
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 512,
        });
        responseText = completion.choices[0].message.content;
      } catch (e) {
        console.warn('Groq suggestion failed:', e.message);
      }
    }

    if (!responseText) {
      return res.json({
        suggestedResolution: 'Review the chat transcript and resolve based on your expertise.',
        estimatedTime: 'Unknown',
        priority: ticket.severity || 'Medium',
        tips: 'Check the chat transcript for key customer pain points.'
      });
    }

    if (responseText.startsWith('```')) responseText = responseText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    res.json(JSON.parse(responseText));
  } catch (error) {
    console.error('Suggestion error:', error.message);
    res.json({
      suggestedResolution: 'Unable to generate AI suggestion. Please review the ticket transcript.',
      estimatedTime: 'Unknown',
      priority: ticket?.severity || 'Medium',
      tips: 'Check the chat transcript for key customer pain points.'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!hasDb()) {
      const ticket = memoryStore.findTicket(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
      return res.json(ticket);
    }

    let ticket = await Ticket.findById(req.params.id).catch(() => null);
    if (!ticket) ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    res.json(ticket);
  } catch (error) {
    console.error('Get ticket error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, assignedAgent, resolutionNotes } = req.body;
    const updateFields = {};

    if (status) {
      const validStatuses = ['open', 'in-progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status. Use: open, in-progress, resolved, or closed.' });
      updateFields.status = status;
    }
    if (assignedAgent) updateFields.assignedAgent = assignedAgent;
    if (resolutionNotes !== undefined) updateFields.resolutionNotes = resolutionNotes;

    let ticket;
    if (!hasDb()) {
      ticket = memoryStore.updateTicket(req.params.id, updateFields);
    } else {
      ticket = await Ticket.findByIdAndUpdate(req.params.id, updateFields, { new: true }).catch(() => null);
      if (!ticket) ticket = await Ticket.findOneAndUpdate({ ticketId: req.params.id }, updateFields, { new: true });
    }

    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    const io = req.app.get('io');
    if (io) io.to('agents').emit('ticket_updated', ticket);
    res.json({ ticket });
  } catch (error) {
    console.error('Update ticket error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
