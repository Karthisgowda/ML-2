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

async function findDemoAgent(email, password) {
  const demoAgents = await getDemoAgents();
  const agent = demoAgents.find((entry) => entry.email === email);
  if (!agent) return null;

  const isMatch = await bcrypt.compare(password, agent.passwordHash);
  if (!isMatch) return null;
  return agent;
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    let agent = null;

    if (hasDb()) {
      const dbAgent = await Agent.findOne({ email });
      if (dbAgent) {
        const isMatch = await bcrypt.compare(password, dbAgent.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });
        agent = dbAgent;
      }
    }

    if (!agent) {
      agent = await findDemoAgent(email, password);
    }

    if (!agent) {
      return res.status(401).json({ error: 'Invalid credentials.' });
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
