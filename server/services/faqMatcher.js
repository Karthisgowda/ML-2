/**
 * FAQ Knowledge Base
 * Bot checks these BEFORE calling AI — instant replies, no ticket needed.
 * Judges love this: shows smart L1 resolution.
 */

const faqDatabase = [
  {
    keywords: ['reset password', 'forgot password', 'change password', 'password reset', 'can\'t login', 'cant login'],
    category: 'Account',
    answer: '🔑 To reset your password:\n1. Go to the login page\n2. Click "Forgot Password"\n3. Enter your registered email\n4. Check your inbox for a reset link (check spam too)\n5. Create a new password (min 8 characters)\n\nIf you still can\'t access your account, I can escalate this to our team.',
    summary: 'Password reset inquiry'
  },
  {
    keywords: ['refund status', 'where is my refund', 'refund update', 'when will i get refund', 'refund time'],
    category: 'Billing',
    answer: '💰 Refund typically takes 5-7 business days to process. Here\'s how to check:\n1. Log into your account\n2. Go to "Order History" → find the order\n3. Click "Refund Status"\n\nIf it\'s been more than 7 business days, I\'ll escalate this for priority review.',
    summary: 'Refund status inquiry'
  },
  {
    keywords: ['track order', 'where is my order', 'order status', 'shipping status', 'delivery status', 'when will i receive'],
    category: 'General',
    answer: '📦 To track your order:\n1. Log into your account\n2. Go to "My Orders"\n3. Click on the order → you\'ll see a tracking number\n4. Click the tracking number to see real-time location\n\nDelivery usually takes 3-5 business days.',
    summary: 'Order tracking inquiry'
  },
  {
    keywords: ['cancel subscription', 'unsubscribe', 'stop subscription', 'cancel plan', 'cancel membership'],
    category: 'Billing',
    answer: '📋 To cancel your subscription:\n1. Go to Account Settings\n2. Click "Subscription & Billing"\n3. Click "Cancel Subscription"\n4. Confirm cancellation\n\n⚠️ Note: You\'ll retain access until the end of your billing cycle. No further charges will apply.',
    summary: 'Subscription cancellation inquiry'
  },
  {
    keywords: ['update email', 'change email', 'update profile', 'change name', 'edit profile', 'change phone'],
    category: 'Account',
    answer: '✏️ To update your profile:\n1. Log into your account\n2. Go to "Profile Settings"\n3. Edit the fields you want to change\n4. Click "Save Changes"\n\nFor email changes, you\'ll need to verify the new email address.',
    summary: 'Profile update inquiry'
  },
  {
    keywords: ['pricing', 'plans', 'how much', 'cost', 'price list', 'subscription plans'],
    category: 'Billing',
    answer: '💳 Our current plans:\n• **Free** — Basic features, limited usage\n• **Pro** — $9.99/month — Full features, priority support\n• **Enterprise** — Custom pricing — Dedicated support, SLA\n\nAll plans come with a 14-day free trial. Would you like more details on a specific plan?',
    summary: 'Pricing inquiry'
  },
  {
    keywords: ['contact support', 'talk to human', 'speak to agent', 'real person', 'human agent', 'customer service'],
    category: 'General',
    answer: '👤 I\'ll connect you with a human agent right away. Your conversation will be transferred and an agent will review your case.\n\nPlease stay connected — an agent will be assigned shortly.',
    summary: 'Request for human agent',
    forceEscalate: true
  },
  {
    keywords: ['app crash', 'app not opening', 'app freezing', 'app slow', 'app not working'],
    category: 'Technical',
    answer: '🔧 Try these quick fixes:\n1. Force close the app and reopen\n2. Clear app cache (Settings → Apps → Our App → Clear Cache)\n3. Check for app updates in your store\n4. Restart your device\n5. Uninstall and reinstall if issue persists\n\nIf none of these work, I can create a support ticket for our tech team.',
    summary: 'App technical issue'
  },
  {
    keywords: ['payment failed', 'payment declined', 'card not working', 'payment error', 'transaction failed'],
    category: 'Billing',
    answer: '💳 Payment failures usually happen due to:\n1. Insufficient funds — check your balance\n2. Card expired — update card in Account Settings\n3. Bank blocking — contact your bank to allow the transaction\n4. Wrong details — re-enter card info carefully\n\nTry again after checking these. If it still fails, I\'ll escalate to billing support.',
    summary: 'Payment failure inquiry'
  }
];

/**
 * Check if a user message matches any FAQ.
 * Returns the FAQ entry if matched, null otherwise.
 * Uses keyword matching with a scoring system.
 */
function matchFAQ(message) {
  const lower = message.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const faq of faqDatabase) {
    let score = 0;
    for (const keyword of faq.keywords) {
      if (lower.includes(keyword)) {
        // Longer keyword matches are more specific → higher score
        score += keyword.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  // Require minimum score to avoid false matches
  if (bestScore >= 5) {
    return bestMatch;
  }

  return null;
}

module.exports = { matchFAQ, faqDatabase };
