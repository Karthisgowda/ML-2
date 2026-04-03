/**
 * Keyword-based fallback classifier.
 * Used when Gemini API fails or returns invalid JSON.
 */
function classifyFallback(message) {
  const lower = message.toLowerCase();
  let category = 'General';
  let severity = 'Medium';
  let securityFlag = false;
  let emotion = 'Calm';
  let urgency = 'Medium';

  // Category detection
  if (/refund|bill|payment|charge|invoice|price|money|subscription|plan/.test(lower)) {
    category = 'Billing';
  } else if (/crash|error|bug|broken|not working|slow|freeze|glitch|down/.test(lower)) {
    category = 'Technical';
  } else if (/account|login|password|access|profile|sign in|register|locked out/.test(lower)) {
    category = 'Account';
  }

  // Security detection (overrides category)
  if (/admin|root|hack|exploit|inject|give me access|bypass|sudo|sql|drop table|social engineering|phishing/.test(lower)) {
    securityFlag = true;
    category = 'Security';
    severity = 'Critical';
    emotion = 'Threatening';
    urgency = 'Immediate';
  }

  // Emotion detection
  if (/furious|angry|pissed|wtf|stupid|idiot|worst|hate|disgusting|trash|garbage|damn|hell/.test(lower)) {
    emotion = 'Angry';
    severity = 'High';
    urgency = 'High';
  } else if (/frustrated|annoying|annoyed|ridiculous|unacceptable|disappointing|sigh|ugh|come on/.test(lower)) {
    emotion = 'Frustrated';
    if (severity === 'Low') severity = 'Medium';
    urgency = 'Medium';
  } else if (/please help|desperate|begging|urgent|emergency|asap|right now|can't wait/.test(lower)) {
    emotion = 'Desperate';
    severity = 'High';
    urgency = 'Immediate';
  } else if (/lawsuit|lawyer|legal|report you|social media|complaint authority|sue|court/.test(lower)) {
    emotion = 'Threatening';
    severity = 'Critical';
    urgency = 'Immediate';
  }

  // Caps detection — if more than 50% uppercase, likely angry
  const upperCount = (message.match(/[A-Z]/g) || []).length;
  const letterCount = (message.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 5 && upperCount / letterCount > 0.5) {
    emotion = 'Angry';
    severity = 'High';
    urgency = 'High';
  }

  // Multiple exclamation marks = urgency
  if (/!!!/.test(message)) {
    if (urgency === 'Low') urgency = 'Medium';
    if (emotion === 'Calm') emotion = 'Frustrated';
  }

  // If security flag is set, keep Critical
  if (securityFlag) severity = 'Critical';

  return {
    response: 'I understand your concern. Let me connect you with a support agent who can assist you further with this matter.',
    category,
    severity,
    emotion,
    urgency,
    securityFlag,
    resolved: false,
    summary: message.substring(0, 100)
  };
}

module.exports = { classifyFallback };

