const { processMessage } = require('../services/aiEngine');
const { matchFAQ } = require('../services/faqMatcher');
const { classifyFallback } = require('../services/fallback');
const Ticket = require('../models/Ticket');
const ChatSession = require('../models/ChatSession');

// Store active chat sessions: socketId -> { name, email, history[], messageCount, sessionId }
const sessions = new Map();

// Rate limiting: track last message time per socket
const rateLimits = new Map();
const RATE_LIMIT_MS = 2000; // 1 message per 2 seconds

module.exports = function chatHandler(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ─── User joins chat ───
    socket.on('user_join', async (data) => {
      const { name, email } = data;

      let sessionDoc;
      if (email && email !== 'no-email') {
        socket.join(`user_${email}`);
        sessionDoc = await ChatSession.findOne({ userEmail: email });
        if (!sessionDoc) {
          sessionDoc = await ChatSession.create({ userEmail: email, messages: [] });
        }
      }

      sessions.set(socket.id, {
        name: name || 'Anonymous',
        email: email || 'no-email',
        history: sessionDoc ? sessionDoc.messages.map(m => ({ role: m.role, message: m.content, content: m.content })) : [],
        messageCount: 0,
        sessionId: sessionDoc ? sessionDoc._id : null
      });
      console.log(`👤 User joined: ${name} (${email})`);

      if (sessionDoc && sessionDoc.messages.length > 0) {
        socket.emit('chat_history', { messages: sessionDoc.messages });
      } else {
        socket.emit('welcome', {
          message: `Hi ${name}! 👋 I'm the SmartDesk AI assistant. How can I help you today?`
        });
      }
    });

    // ─── Agent joins dashboard room ───
    socket.on('agent_join', () => {
      socket.join('agents');
      console.log(`🛡️ Agent connected to dashboard: ${socket.id}`);
    });

    // ─── Agent sends direct message to User ───
    socket.on('agent_direct_message', async (data) => {
      const { userEmail, message, ticketId } = data;
      if (!userEmail || !message) return;

      console.log(`💬 Agent direct message to user ${userEmail}: ${message}`);

      // Save to chat session if exists
      const sessionDoc = await ChatSession.findOne({ userEmail });
      if (sessionDoc) {
        sessionDoc.messages.push({ role: 'agent', content: message, timestamp: new Date() });
        await sessionDoc.save();
      }

      // Also append to active ticket transcript if ticketId is provided
      if (ticketId) {
        const ticket = await Ticket.findOne({ ticketId });
        if (ticket) {
          ticket.transcript.push({ role: 'agent', content: message, message });
          await ticket.save();
          // Update all agents about the ticket change (they listen to ticket_updated maybe)
          io.to('agents').emit('ticket_updated', ticket);
        }
      }

      // Emit directly to the user's personal room
      io.to(`user_${userEmail}`).emit('bot_message', {
        message: message,
        role: 'agent',
        category: 'General',
        severity: 'Low',
        resolved: false,
        suggestedReplies: []
      });
    });

    // ─── User requests to clear chat history ───
    socket.on('clear_chat_history', async (data) => {
      const { email } = data;
      if (email) {
        console.log(`🧹 Clearing chat history for: ${email}`);
        await ChatSession.findOneAndUpdate({ userEmail: email }, { $set: { messages: [] } });
        const session = sessions.get(socket.id);
        if (session) {
          session.history = [];
          session.messageCount = 0;
        }
      }
    });

    // ─── User sends a message ───
    // Listen on both 'user_message' (Adi's frontend) and 'send_message' (legacy)
    const handleUserMessage = async (data) => {
      const session = sessions.get(socket.id);
      if (!session) {
        socket.emit('error_message', { error: 'Session not found. Please reconnect.' });
        return;
      }

      const message = data.message || data.text || '';
      const forceEscalate = data.forceEscalate || false;
      if (!message || message.trim() === '') return;

      // ─── Rate Limiting ───
      const now = Date.now();
      const lastMsg = rateLimits.get(socket.id) || 0;
      if (now - lastMsg < RATE_LIMIT_MS) {
        socket.emit('error_message', { error: 'Please wait a moment before sending another message.' });
        return;
      }
      rateLimits.set(socket.id, now);

      session.messageCount++;

      // Add user message to history
      session.history.push({
        role: 'user',
        message: message.trim(),
        content: message.trim(), // Adi's frontend uses 'content'
        timestamp: new Date()
      });

      if (session.sessionId) {
        await ChatSession.findByIdAndUpdate(session.sessionId, {
          $push: { messages: { role: 'user', content: message.trim(), timestamp: new Date() } }
        });
      }

      try {
        // ─── STEP 1: Check FAQ first (instant resolution) ───
        const faqMatch = matchFAQ(message.trim());

        let aiResult;

        if (faqMatch && session.messageCount <= 2) {
          // FAQ matched! Instant response without calling AI
          console.log(`📚 FAQ matched: ${faqMatch.summary}`);
          aiResult = {
            response: faqMatch.answer,
            category: faqMatch.category,
            severity: 'Low',
            emotion: 'Calm',
            urgency: 'Low',
            resolved: !faqMatch.forceEscalate,
            securityFlag: false,
            summary: faqMatch.summary,
            faqMatched: true,
            suggestedReplies: ['Thanks, that helped!', 'I still need help', 'Talk to a human'],
            sentimentScore: 0.6
          };

          // If FAQ says force escalate (e.g., "talk to human")
          if (faqMatch.forceEscalate) {
            aiResult.resolved = false;
            aiResult.severity = 'Medium';
          }
        } else {
          // ─── STEP 2: No FAQ match → full AI processing ───
          try {
            aiResult = await processMessage(message.trim(), session.history);
          } catch (aiError) {
            console.warn('⚠️ AI processing failed, using keyword fallback:', aiError.message);
            aiResult = classifyFallback(message.trim());
            aiResult.suggestedReplies = aiResult.suggestedReplies || ['Tell me more', 'I need help', 'Talk to a human'];
            aiResult.sentimentScore = aiResult.sentimentScore || 0.5;
          }
        }

        // Add bot response to history
        session.history.push({
          role: 'bot',
          message: aiResult.response,
          content: aiResult.response,
          timestamp: new Date()
        });

        if (session.sessionId) {
          await ChatSession.findByIdAndUpdate(session.sessionId, {
            $push: { messages: { role: 'bot', content: aiResult.response, timestamp: new Date() } }
          });
        }

        // Send AI response to user
        socket.emit('bot_message', {
          message: aiResult.response,
          category: aiResult.category,
          severity: aiResult.severity,
          emotion: aiResult.emotion,
          urgency: aiResult.urgency,
          securityFlag: aiResult.securityFlag,
          resolved: aiResult.resolved,
          summary: aiResult.summary,
          suggestedReplies: aiResult.suggestedReplies || [],
          sentimentScore: aiResult.sentimentScore ?? 0.5
        });

        // ─── Escalation Logic ───
        const detailsReady = aiResult.detailsGathered !== false; // default true if field missing
        const shouldEscalate =
          forceEscalate ||
          (!aiResult.resolved && detailsReady && (
            session.messageCount >= 3 ||
            aiResult.severity === 'High' ||
            aiResult.severity === 'Critical' ||
            aiResult.securityFlag
          ));

        if (shouldEscalate) {
          // If forceEscalate but AI gave resolved:true, override
          if (forceEscalate) {
            aiResult.resolved = false;
            if (aiResult.severity === 'Low') aiResult.severity = 'Medium';
          }

          // ─── Generate AI Agent Briefing ───
          let agentBriefing = '';
          try {
            const transcriptText = session.history
              .map(m => `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.message || m.content || ''}`)
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

            if (process.env.GROQ_API_KEY) {
              const Groq = require('groq-sdk');
              const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
              const comp = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: briefingPrompt }],
                temperature: 0.3, max_tokens: 400,
              });
              agentBriefing = comp.choices[0].message.content.trim();
            } else if (process.env.GEMINI_API_KEY) {
              const { GoogleGenerativeAI } = require('@google/generative-ai');
              const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
              const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
              const result = await model.generateContent(briefingPrompt);
              agentBriefing = result.response.text().trim();
            }
          } catch (briefErr) {
            console.warn('⚠️ Agent briefing generation failed:', briefErr.message);
            agentBriefing = `Issue: ${aiResult.summary}\nSeverity: ${aiResult.severity}\nEmotion: ${aiResult.emotion}`;
          }

          const ticket = await Ticket.create({
            userName: session.name,
            userEmail: session.email,
            category: aiResult.category,
            severity: aiResult.severity,
            emotion: aiResult.emotion,
            urgency: aiResult.urgency,
            summary: aiResult.summary || `User requested human assistance`,
            transcript: session.history,
            securityFlag: aiResult.securityFlag,
            agentBriefing: agentBriefing
          });

          console.log(`🎫 Ticket created: ${ticket.ticketId} [${aiResult.severity}] ${aiResult.category}`);

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
            transcript: session.history
          };

          socket.emit('ticket_created', ticketData);
          io.to('agents').emit('new_ticket', ticketData);

          session.history = [];
          session.messageCount = 0;
        }
      } catch (error) {
        console.error('❌ Chat error:', error.message);
        // Last resort: if forceEscalate, still create a ticket
        if (forceEscalate) {
          try {
            const ticket = await Ticket.create({
              userName: session.name,
              userEmail: session.email,
              category: 'General',
              severity: 'Medium',
              emotion: 'Frustrated',
              urgency: 'High',
              summary: 'User requested human agent (system error during processing)',
              transcript: session.history,
              securityFlag: false
            });
            const ticketData = {
              ticketId: ticket.ticketId, _id: ticket._id,
              userName: ticket.userName, userEmail: ticket.userEmail,
              category: 'General', severity: 'Medium',
              summary: ticket.summary, status: ticket.status,
              securityFlag: false, createdAt: ticket.createdAt,
              transcript: session.history
            };
            socket.emit('ticket_created', ticketData);
            io.to('agents').emit('new_ticket', ticketData);
            session.history = []; session.messageCount = 0;
            return;
          } catch (ticketErr) {
            console.error('❌ Emergency ticket creation failed:', ticketErr.message);
          }
        }
        socket.emit('bot_message', {
          message: "I'm having trouble right now. Please try again in a moment.",
          category: 'General',
          severity: 'Low',
          suggestedReplies: ['Try again', 'Talk to a human'],
          sentimentScore: 0.5
        });
      }
    };

    socket.on('user_message', handleUserMessage);
    socket.on('send_message', handleUserMessage); // legacy compat

    // ─── Disconnect ───
    socket.on('disconnect', () => {
      sessions.delete(socket.id);
      rateLimits.delete(socket.id);
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};
