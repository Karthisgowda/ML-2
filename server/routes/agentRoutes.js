const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Agent = require('../models/Agent');
const mongoose = require('mongoose');
const { getDemoAgents } = require('../services/memoryStore');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'smartdesk-demo-secret';

function hasDb() {
  return mongoose.connection.readyState === 1;
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    let agent;
    if (hasDb()) {
      agent = await Agent.findOne({ email });
      if (!agent) return res.status(401).json({ error: 'Invalid credentials.' });

      const isMatch = await bcrypt.compare(password, agent.password);
      if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });
    } else {
      const demoAgents = await getDemoAgents();
      agent = demoAgents.find((entry) => entry.email === email);
      if (!agent) return res.status(401).json({ error: 'Invalid credentials.' });

      const isMatch = await bcrypt.compare(password, agent.passwordHash);
      if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: agent._id || agent.id, name: agent.name, email: agent.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      agent: { id: agent._id || agent.id, name: agent.name, email: agent.email }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
