const express = require('express');
const ChatSession = require('../models/ChatSession');
const Ticket = require('../models/Ticket');
const mongoose = require('mongoose');
const { processMessage } = require('../services/aiEngine');
const { matchFAQ } = require('../services/faqMatcher');
const { classifyFallback } = require('../services/fallback');
const memoryStore = require('../services/memoryStore');

const router = express.Router();

function hasDb() {
  return mongoose.connection.readyState === 1;
}

async function findOrCreateSession(email) {
  const safeEmail = email || 'no-email';

  if (!hasDb()) {
    return memoryStore.getSession(safeEmail);
  }

  let sessionDoc = await ChatSession.findOne({ userEmail: safeEmail });
  if (!sessionDoc) {
    sessionDoc = await ChatSession.create({ userEmail: safeEmail, messages: [] });
  }
  return sessionDoc;
}

function mapSessionHistory(sessionDoc) {
  return (sessionDoc?.messages || []).map((message) => ({
    role: message.role,
    message: message.content || message.message,
    content: message.content || message.message,
    timestamp: message.timestamp,
  }));
}

async function persistSession(email, sessionDoc) {
  if (!hasDb()) {
    memoryStore.setSession(email, sessionDoc);
    return;
  }

  await sessionDoc.save();
}

async function clearSession(email, sessionDoc) {
  if (!hasDb()) {
    memoryStore.clearSession(email);
    return;
  }

  sessionDoc.messages = [];
  await sessionDoc.save();
}

async function buildAgentBriefing(session, aiResult) {
  const transcriptText = session.history
    .map((entry) => `${entry.role === 'user' ? 'Customer' : 'AI'}: ${entry.message || entry.content || ''}`)
    .join('\n');

  const briefingPrompt = `You are a support team lead. Based on this conversation, write a concise but comprehensive agent briefing.

Customer: ${session.name} (${session.email})
Category: ${aiResult.category} | Severity: ${aiResult.severity} | Emotion: ${aiResult.emotion}

Conversation:
${transcriptText}

Write a briefing in this format (plain text, no JSON, no markdown):
ISSUE: [one-sentence description]
DETAILS: [what happened, when, and the impact]
CUSTOMER MOOD: [emotional state and how to approach]
STEPS TRIED: [what the customer already attempted]
RECOMMENDED ACTION: [specific next steps for the agent]
PRIORITY NOTES: [any urgency or special handling needed]`;

  try {
    if (process.env.GROQ_API_KEY) {
      const Groq = require('groq-sdk');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: briefingPrompt }],
        temperature: 0.3,
        max_tokens: 400,
      });

      return completion.choices[0].message.content.trim();
    }
  } catch (error) {
    console.warn('Agent briefing generation failed:', error.message);
  }

  return `Issue: ${aiResult.summary}\nSeverity: ${aiResult.severity}\nEmotion: ${aiResult.emotion}`;
}

async function createEscalationTicket(session, aiResult, io) {
  const agentBriefing = await buildAgentBriefing(session, aiResult);
  let ticket;

  if (hasDb()) {
    ticket = await Ticket.create({
      userName: session.name,
      userEmail: session.email,
      category: aiResult.category,
      severity: aiResult.severity,
      emotion: aiResult.emotion,
      urgency: aiResult.urgency,
      summary: aiResult.summary || 'User requested human assistance',
      transcript: session.history,
      securityFlag: aiResult.securityFlag,
      agentBriefing,
    });
  } else {
    ticket = memoryStore.createTicket({
      userName: session.name,
      userEmail: session.email,
      category: aiResult.category,
      severity: aiResult.severity,
      emotion: aiResult.emotion,
      urgency: aiResult.urgency,
      summary: aiResult.summary || 'User requested human assistance',
      transcript: session.history,
      securityFlag: aiResult.securityFlag,
      agentBriefing,
    });
  }

  const ticketData = {
    ticketId: ticket.ticketId,
    _id: ticket._id,
    userName: ticket.userName,
    userEmail: ticket.userEmail,
    category: ticket.category,
    severity: ticket.severity,
    emotion: ticket.emotion,
    urgency: ticket.urgency,
    summary: ticket.summary,
    status: ticket.status,
    securityFlag: ticket.securityFlag,
    agentBriefing: ticket.agentBriefing,
    createdAt: ticket.createdAt,
    transcript: session.history,
  };

  if (io) io.to('agents').emit('new_ticket', ticketData);
  return ticketData;
}

router.get('/session', async (req, res) => {
  try {
    const email = req.query.email || 'no-email';
    const sessionDoc = await findOrCreateSession(email);

    res.json({
      messages: sessionDoc.messages || [],
      suggestions: (sessionDoc.messages || []).length > 0
        ? []
        : ['I have a billing issue', 'Technical problem', 'Account help'],
    });
  } catch (error) {
    console.error('Chat session fetch error:', error.message);
    res.status(500).json({ error: 'Unable to load chat session.' });
  }
});

router.post('/session/clear', async (req, res) => {
  try {
    const email = req.body.email || 'no-email';
    if (hasDb()) {
      await ChatSession.findOneAndUpdate(
        { userEmail: email },
        { $set: { messages: [] } },
        { upsert: true, new: true }
      );
    } else {
      memoryStore.clearSession(email);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Chat clear error:', error.message);
    res.status(500).json({ error: 'Unable to clear chat session.' });
  }
});

router.post('/message', async (req, res) => {
  try {
    const name = (req.body.name || 'Anonymous').trim() || 'Anonymous';
    const email = (req.body.email || 'no-email').trim() || 'no-email';
    const rawMessage = req.body.message || '';
    const forceEscalate = Boolean(req.body.forceEscalate);
    const message = rawMessage.trim();

    if (!message) return res.status(400).json({ error: 'Message is required.' });

    const sessionDoc = await findOrCreateSession(email);
    const session = {
      name,
      email,
      history: mapSessionHistory(sessionDoc),
      messageCount: (sessionDoc.messages || []).filter((entry) => entry.role === 'user').length,
    };

    const userEntry = { role: 'user', content: message, message, timestamp: new Date() };
    session.history.push(userEntry);
    session.messageCount += 1;
    sessionDoc.messages = [...(sessionDoc.messages || []), userEntry];

    let aiResult;
    const faqMatch = matchFAQ(message);

    if (faqMatch && session.messageCount <= 2) {
      aiResult = {
        response: faqMatch.answer,
        category: faqMatch.category,
        severity: faqMatch.forceEscalate ? 'Medium' : 'Low',
        emotion: 'Calm',
        urgency: 'Low',
        resolved: !faqMatch.forceEscalate,
        securityFlag: false,
        summary: faqMatch.summary,
        faqMatched: true,
        suggestedReplies: ['Thanks, that helped!', 'I still need help', 'Talk to a human'],
        sentimentScore: 0.6,
      };
    } else {
      try {
        aiResult = await processMessage(message, session.history);
      } catch (error) {
        console.warn('AI processing failed, using fallback:', error.message);
        aiResult = classifyFallback(message);
        aiResult.suggestedReplies = aiResult.suggestedReplies || ['Tell me more', 'I need help', 'Talk to a human'];
        aiResult.sentimentScore = aiResult.sentimentScore || 0.5;
      }
    }

    const botEntry = { role: 'bot', content: aiResult.response, message: aiResult.response, timestamp: new Date() };
    session.history.push(botEntry);
    sessionDoc.messages = [...sessionDoc.messages, botEntry];

    const detailsReady = aiResult.detailsGathered !== false;
    const shouldEscalate = forceEscalate || (!aiResult.resolved && detailsReady && (
      session.messageCount >= 3 || aiResult.severity === 'High' || aiResult.severity === 'Critical' || aiResult.securityFlag
    ));

    let ticket = null;
    if (shouldEscalate) {
      if (forceEscalate) {
        aiResult.resolved = false;
        if (aiResult.severity === 'Low') aiResult.severity = 'Medium';
      }
      ticket = await createEscalationTicket(session, aiResult, req.app.get('io'));
      await clearSession(email, sessionDoc);
    } else {
      await persistSession(email, sessionDoc);
    }

    res.json({
      message: aiResult.response,
      category: aiResult.category,
      severity: aiResult.severity,
      emotion: aiResult.emotion,
      urgency: aiResult.urgency,
      securityFlag: aiResult.securityFlag,
      resolved: aiResult.resolved,
      summary: aiResult.summary,
      suggestedReplies: aiResult.suggestedReplies || [],
      sentimentScore: aiResult.sentimentScore ?? 0.5,
      ticket,
    });
  } catch (error) {
    console.error('Chat message error:', error.message);
    res.status(500).json({
      error: 'Unable to process message right now.',
      fallback: {
        message: "I'm having trouble right now. Please try again in a moment.",
        category: 'General',
        severity: 'Low',
        suggestedReplies: ['Try again', 'Talk to a human'],
        sentimentScore: 0.5,
      },
    });
  }
});

module.exports = router;
