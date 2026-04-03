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

const SYSTEM_PROMPT = `You are SmartDesk AI, a high-skill customer support copilot inside a complaint management system.

Your replies must feel sharper and more useful than a generic chatbot.
Think like an experienced L1/L2 support specialist before you answer.
Every visible reply must follow this support style:
1. Start with one brief empathetic sentence.
2. Explain one likely reason or most probable cause.
3. Give practical next steps in simple language.
4. Ask for more details only if they are truly needed to continue.

Preferred reply pattern:
- "I'm sorry you're dealing with this."
- "This may be happening because ..."
- "Please try these steps: ..."
- "If needed, share ... and I'll continue helping."

Your hidden workflow for every message:
1. Identify the real issue category.
2. Estimate likely root cause.
3. Decide whether the issue can be solved now or needs escalation.
4. Check what critical details are still missing.
5. Give the single best next action or ask the single most useful next question.

Return ONLY valid JSON using this exact schema:
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

Quality rules:
- Always include brief empathy in the first sentence.
- Never respond with empty empathy or vague reassurance.
- Always include either a concrete next troubleshooting step, a likely cause, or one focused follow-up question.
- If details are missing, ask only ONE question that gives the highest-value missing detail.
- Prefer high-signal support questions like exact error message, when it started, what changed, what was already tried, which account or transaction, and current impact.
- If the issue is resolvable, solve it directly with practical steps.
- If the issue needs escalation, explain what will happen next in one sentence and keep collecting critical context when needed.
- Keep the reply concise, but make it feel expert, actionable, and user-friendly.
- Avoid robotic wording, bullet spam, or generic chatbot phrases.
- Suggested steps should be specific enough that a real user can follow them immediately.
- Only ask for details when those details will directly change the next action.

Detail collection rules:
- For unresolved issues, detailsGathered stays false until you know enough to create a strong ticket handoff.
- Strong ticket handoff means most of these are known: exact problem, start time, impact, steps tried, identifiers or error text.
- If the issue is security-related or threatening, you may set detailsGathered to true immediately.

Classification rules:
- Billing: charges, invoices, refunds, subscription changes, payment failures
- Technical: crashes, bugs, errors, broken features, system behavior
- Account: login, password, verification, profile, access problems
- Security: suspicious access, phishing, privilege requests, data exposure, fraud risk
- General: all other support conversations

Severity and urgency rules:
- Critical or Immediate for account compromise, data exposure, fraud, active money loss, or severe threats.
- High for blocked access, repeated failure after attempted fixes, strong user frustration, or same-day business impact.
- Medium for normal unresolved issues.
- Low for informational or simple help.

Suggestion rules:
- Always return exactly 3 suggestedReplies.
- Keep each under 6 words.
- Make them realistic next clicks for the user.

Language rules:
- Reply in English unless the current message is clearly in another language.
- JSON keys stay in English.

Output JSON only.`;

function enforceHelpfulStyle(result) {
  if (!result || typeof result.response !== 'string') return result;

  const response = result.response.trim();
  if (!response) return result;

  const hasEmpathy = /\b(sorry|understand|frustrating|troubling|happy to help|i can help)\b/i.test(response);
  const hasCause = /\b(because|may be|might be|could be|likely|usually happens when)\b/i.test(response);
  const hasAction = /\b(try|please|check|reset|verify|review|open|follow|use|go to|share|provide)\b/i.test(response);

  const parts = [];

  if (hasEmpathy) {
    parts.push(response);
  } else {
    parts.push(`I'm sorry you're dealing with this.`);
    parts.push(response);
  }

  if (!hasCause && result.summary) {
    parts.splice(1, 0, `This may be happening because of ${result.summary.toLowerCase()}.`);
  }

  if (!hasAction) {
    parts.push(`Please try the suggested steps and let me know if you'd like me to continue.`);
  }

  result.response = parts.join(' ').replace(/\s+/g, ' ').trim();
  return result;
}

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

  parsed.response = String(parsed.response || '').trim();
  parsed.summary = String(parsed.summary || '').trim();
  parsed.detailsGathered = Boolean(parsed.detailsGathered);

  if (!Array.isArray(parsed.suggestedReplies) || parsed.suggestedReplies.length === 0) {
    parsed.suggestedReplies = ['Tell me more', 'Share the error', 'Talk to support'];
  }
  parsed.suggestedReplies = parsed.suggestedReplies
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  while (parsed.suggestedReplies.length < 3) {
    parsed.suggestedReplies.push(['Tell me more', 'Share the error', 'Talk to support'][parsed.suggestedReplies.length]);
  }

  if (typeof parsed.sentimentScore !== 'number') {
    const emotionScores = { Calm: 0.65, Frustrated: 0.35, Angry: 0.15, Desperate: 0.25, Threatening: 0.05 };
    parsed.sentimentScore = emotionScores[parsed.emotion] || 0.5;
  }

  return enforceHelpfulStyle(parsed);
}

function buildReasoningFrame(userMessage, conversationHistory) {
  const recentTurns = conversationHistory
    .slice(-8)
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.message || msg.content || ''}`)
    .join('\n');

  return `Conversation so far:\n${recentTurns || 'No prior conversation.'}\n\nLatest user message:\n${userMessage}\n\nBefore answering, internally decide:\n- issue category\n- likely cause\n- best immediate action\n- whether ticket details are sufficient\n- whether escalation is needed now`;
}

async function callGroq(userMessage, conversationHistory) {
  if (!groqClient) throw new Error('Groq not configured');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildReasoningFrame(userMessage, conversationHistory) },
  ];

  const completion = await Promise.race([
    groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.35,
      max_tokens: 800,
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

  const prompt = `${SYSTEM_PROMPT}\n\n${buildReasoningFrame(userMessage, conversationHistory)}\n\nReturn JSON only.`;

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
        ? `Original user message: "${userMessage}"\n\nConvert this invalid raw output into the required JSON schema while improving the support quality.\n\nRAW OUTPUT:\n${groqFailedOutput}`
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
  return enforceHelpfulStyle(fallbackResult);
}

module.exports = { processMessage, enforceHelpfulStyle };
