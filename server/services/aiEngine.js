const { classifyFallback } = require('./fallback');

let groqClient = null;
let geminiModel = null;

try {
  if (process.env.GROQ_API_KEY) {
    const Groq = require('groq-sdk');
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log('Groq API initialized');
  }
} catch (e) {
  console.warn('Groq SDK not available, will try Gemini');
}

try {
  if (process.env.GEMINI_API_KEY) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('Gemini API initialized');
  }
} catch (e) {
  console.warn('Gemini SDK not available');
}

const SYSTEM_PROMPT = `You are SmartDesk AI, a premium customer support copilot for a complaint management system.

You must be smarter than a generic chatbot. Your job is to:
- understand the exact issue
- ask sharp follow-up questions when details are missing
- give practical next steps, not vague reassurance
- detect severity, urgency, security risk, and escalation need
- write responses that feel professional, calm, and genuinely useful

Return ONLY valid JSON with this exact schema:
{
  "response": "helpful support reply",
  "category": "Billing" or "Technical" or "Account" or "General" or "Security",
  "severity": "Low" or "Medium" or "High" or "Critical",
  "emotion": "Angry" or "Frustrated" or "Desperate" or "Threatening" or "Calm",
  "urgency": "Immediate" or "High" or "Medium" or "Low",
  "resolved": true or false,
  "securityFlag": true or false,
  "summary": "one line issue summary",
  "detailsGathered": true or false,
  "suggestedReplies": ["short option 1", "short option 2", "short option 3"],
  "sentimentScore": 0.0 to 1.0
}

Response quality rules:
- Never give generic filler like "I understand your concern" without adding concrete help.
- If the user reports a problem, respond with a useful next step, likely cause, or exact detail you need.
- If details are missing, ask ONE focused question only.
- If the issue is simple, resolve it directly in the same reply.
- If the issue needs escalation, explain briefly what will happen next.
- Keep the response concise but specific.
- If the user is upset, acknowledge that first, then move into action.

Detail gathering rules:
- For unresolved issues, keep detailsGathered false until you know what happened, when it started, user impact, steps tried, and any useful identifiers or error messages.
- If securityFlag is true or emotion is Threatening, detailsGathered can be true immediately.

Classification rules:
- Billing: refunds, invoices, charges, payments, subscriptions
- Technical: bugs, crashes, errors, system failures, broken flows
- Account: login, password, access, profile, account verification
- Security: phishing, unauthorized access, data exposure, admin access requests, suspicious behavior
- General: everything else

Severity and urgency rules:
- Critical or Immediate if account compromise, data leak, money loss in progress, or severe threat
- High if user is blocked, very angry, or business impact is likely today
- Medium for normal unresolved issues
- Low for basic informational requests

Suggested reply rules:
- always return 3 short clickable suggestions
- keep each suggestion under 6 words
- make them context-aware

Language rules:
- reply in English unless the current user message is clearly in another language
- keep JSON keys in English at all times

Always output valid JSON only.`;

function parseAIResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }

  const parsed = JSON.parse(cleaned);
  const required = ['response', 'category', 'severity', 'resolved', 'securityFlag', 'summary'];
  for (const field of required) {
    if (parsed[field] === undefined) {
      throw new Error(`Missing field: ${field}`);
    }
  }

  const validCategories = ['Billing', 'Technical', 'Account', 'General', 'Security'];
  const validSeverities = ['Low', 'Medium', 'High', 'Critical'];
  const validEmotions = ['Angry', 'Frustrated', 'Desperate', 'Threatening', 'Calm'];
  const validUrgencies = ['Immediate', 'High', 'Medium', 'Low'];

  if (!validCategories.includes(parsed.category)) parsed.category = 'General';
  if (!validSeverities.includes(parsed.severity)) parsed.severity = 'Medium';
  if (!validEmotions.includes(parsed.emotion)) parsed.emotion = 'Calm';
  if (!validUrgencies.includes(parsed.urgency)) parsed.urgency = 'Medium';
  if (!Array.isArray(parsed.suggestedReplies) || parsed.suggestedReplies.length === 0) {
    parsed.suggestedReplies = ['Tell me more', 'Share the error', 'Talk to support'];
  }
  if (typeof parsed.sentimentScore !== 'number') {
    const emotionScores = { Calm: 0.65, Frustrated: 0.35, Angry: 0.15, Desperate: 0.25, Threatening: 0.05 };
    parsed.sentimentScore = emotionScores[parsed.emotion] || 0.5;
  }

  parsed.response = String(parsed.response || '').trim();
  parsed.summary = String(parsed.summary || '').trim();
  return parsed;
}

async function callGroq(userMessage, conversationHistory) {
  if (!groqClient) throw new Error('Groq not configured');

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const msg of conversationHistory.slice(-8)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.message || msg.content || ''
    });
  }
  messages.push({ role: 'user', content: userMessage });

  const completion = await Promise.race([
    groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.45,
      max_tokens: 700,
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Groq timeout')), 12000))
  ]);

  try {
    return parseAIResponse(completion.choices[0].message.content);
  } catch (err) {
    if (completion?.choices?.[0]?.message?.content) {
      err.rawOutput = completion.choices[0].message.content;
    }
    throw err;
  }
}

async function callGemini(userMessage, conversationHistory) {
  if (!geminiModel) throw new Error('Gemini not configured');

  let prompt = `${SYSTEM_PROMPT}\n\nConversation:\n`;
  for (const msg of conversationHistory.slice(-8)) {
    const content = msg.message || msg.content || '';
    prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${content}\n`;
  }
  prompt += `User: ${userMessage}\n\nReturn JSON only.`;

  const result = await Promise.race([
    geminiModel.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 12000))
  ]);

  return parseAIResponse(result.response.text());
}

async function processMessage(userMessage, conversationHistory = []) {
  let groqFailedOutput = null;

  if (groqClient) {
    try {
      const result = await callGroq(userMessage, conversationHistory);
      console.log('[Groq] AI response received');
      return result;
    } catch (error) {
      console.warn('Groq failed:', error.message);
      if (error.rawOutput) groqFailedOutput = error.rawOutput;
    }
  }

  if (geminiModel) {
    try {
      const messageForGemini = groqFailedOutput
        ? `Original user message: "${userMessage}"\n\nPlease rewrite this invalid raw model output into the correct JSON schema.\n\nRAW OUTPUT:\n${groqFailedOutput}`
        : userMessage;
      const result = await callGemini(messageForGemini, conversationHistory);
      console.log('[Gemini] AI response received');
      return result;
    } catch (error) {
      console.warn('Gemini failed:', error.message);
    }
  }

  console.log('Using keyword fallback classifier');
  const fallbackResult = classifyFallback(userMessage);
  fallbackResult.suggestedReplies = fallbackResult.suggestedReplies || ['Tell me more', 'Share the error', 'Talk to support'];
  fallbackResult.sentimentScore = fallbackResult.sentimentScore || 0.5;
  return fallbackResult;
}

module.exports = { processMessage };
