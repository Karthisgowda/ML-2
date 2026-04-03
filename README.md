<div align="center">

# ⚡ SmartDesk — AI-Powered Complaint Management System

### National Hackathon 2026 · Problem Statement P4 · Team Spark #80

An end-to-end support portal that uses **AI chatbot deflection**, **automated ticket routing**, and a **real-time agent dashboard** to reduce manual ticket sorting and improve resolution time.

[![Tech Stack](https://img.shields.io/badge/Stack-MERN-00d9ff?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![AI](https://img.shields.io/badge/AI-LLM_API-ff6b6b?style=for-the-badge&logo=openai&logoColor=white)](https://console.groq.com/)
[![Real-time](https://img.shields.io/badge/Real--time-Socket.IO-34c759?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)

</div>

---

## 🎯 Problem

Customer support teams are overwhelmed by repetitive L1 queries (_"Where is my refund?"_). This delays resolution of complex, high-priority issues. Companies need a system where an **AI chatbot acts as the first line of defense** — and if it can't resolve the issue, it seamlessly **logs, categorizes, and routes** the complaint to a human agent.

## 💡 Solution

SmartDesk provides:

| Layer | What it does |
|---|---|
| **AI Chatbot** | Resolves L1 queries instantly (password resets, FAQs, status checks) |
| **Auto Severity Scoring** | Analyzes user language → assigns Low / Medium / High / Critical |
| **Smart Categorization** | Tags tickets: Billing, Technical, Account, General, Security |
| **Emotion Detection** | Detects: Angry, Frustrated, Desperate, Threatening, Calm |
| **Security Flag** | Catches social engineering, phishing, unauthorized access attempts |
| **Agent Dashboard** | Claim tickets, view transcripts, update status, resolve issues |
| **Real-time Updates** | New tickets appear on dashboard instantly via WebSockets |

---

## 🏗️ Architecture

```
┌─────────────┐     WebSocket      ┌──────────────────┐     MongoDB
│   React UI  │ ◄──────────────► │   Express + S.IO  │ ◄──────────► Atlas
│  (Vite)     │     REST API      │                  │
│             │ ◄──────────────► │   AI Engine       │ ──► Groq API
│  • Chat     │                   │   (3-layer)       │ ──► Gemini API
│  • Dashboard│                   │                  │ ──► Keyword Fallback
│  • Auth     │                   │   JWT Auth        │
└─────────────┘                   └──────────────────┘
```

### AI Engine — 3-Layer Fallback

1. **Groq API** (llama-3.3-70b) — Primary, fastest inference
2. **Google Gemini** (1.5-flash) — Fallback #1
3. **Keyword Regex** — Fallback #2, always works offline

---

## ✨ Key Features

### 🤖 Conversational AI Chat
- Natural language understanding via LLM
- **Quick reply suggestion pills** — clickable options for faster interaction
- **Multilingual support** — bot detects and replies in user's language (Hindi, English, etc.)
- **Live sentiment meter** — visual emoji + color bar showing real-time emotion
- FAQ matching for instant L1 resolution
- Auto-escalation after 3+ messages or high severity

### 🎫 Smart Ticket Generation
- **Automatic** — created when AI determines human intervention needed
- Captures: full transcript, user details, AI-classified metadata
- Severity scored from user's language patterns (caps, punctuation, word choice)
- Security threats flagged and escalated immediately

### 📊 Agent Dashboard
- JWT-secured login
- **Interactive analytics** — pie chart (by category), bar chart (by severity)
- Compact **pill-based filters** for status and severity
- Real-time ticket stream via Socket.IO
- Claim → In Progress → Resolved workflow
- Full chat transcript viewer in ticket modal
- **CSV export** for reporting
- **Satisfaction ratings** (👍👎) from users

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, React Router, Recharts, Socket.IO Client |
| **Backend** | Node.js, Express 5, Socket.IO, Mongoose |
| **Database** | MongoDB Atlas (free tier) |
| **AI/NLP** | Groq SDK (llama-3.3-70b), Google Gemini 1.5 Flash |
| **Auth** | JWT (jsonwebtoken), bcryptjs |
| **Real-time** | Socket.IO (WebSocket + long-polling fallback) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- At least one AI API key: [Groq](https://console.groq.com/) (recommended) or [Google AI Studio](https://aistudio.google.com/)

### 1. Clone & Setup

```bash
git clone https://github.com/your-team/smartdesk.git
cd smartdesk
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your API keys and MongoDB URI
npm run seed     # Create demo agent accounts
npm run dev      # Start on port 5000
```

### 3. Frontend

```bash
cd client
npm install
npm run dev      # Start on port 5173
```

### 4. Open

- **Chat**: http://localhost:5173
- **Agent Login**: http://localhost:5173/agent/login

---

## 🔐 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Agent | `rakesh@smartdesk.dev` | `agent123` |
| Agent | `ujjwal@smartdesk.dev` | `agent123` |
| Agent | `adi@smartdesk.dev` | `agent123` |

---

## 📁 Project Structure

```
final/
├── server/                   # Express + Socket.IO backend
│   ├── config/db.js          # MongoDB connection
│   ├── middleware/auth.js    # JWT authentication
│   ├── models/
│   │   ├── Agent.js          # Agent schema
│   │   └── Ticket.js         # Ticket schema (severity, emotion, urgency)
│   ├── routes/
│   │   ├── agentRoutes.js    # Login endpoint
│   │   └── ticketRoutes.js   # CRUD + AI suggestions
│   ├── services/
│   │   ├── aiEngine.js       # 3-layer AI (Groq → Gemini → regex)
│   │   ├── faqMatcher.js     # L1 FAQ instant resolution
│   │   └── fallback.js       # Keyword classifier
│   ├── socket/chatHandler.js # Real-time chat logic
│   ├── scripts/seedAgents.js # Database seeder
│   └── server.js             # Entry point
│
├── client/                   # React + Vite frontend
│   └── src/
│       ├── api/axios.js      # Axios with JWT interceptor
│       ├── components/       # TicketCard, TicketModal, StatsPanel
│       ├── context/          # UserContext (session management)
│       └── pages/
│           ├── LandingPage   # User entry point
│           ├── ChatPage      # AI chat with sentiment meter
│           ├── AgentLogin    # JWT login
│           └── Dashboard     # Ticket management + analytics
│
├── .gitignore
└── README.md
```

---

## 🧪 Test Scenarios

| # | Test | Expected Result |
|---|---|---|
| 1 | Ask _"How do I reset my password?"_ | Bot resolves it (L1), no ticket |
| 2 | Complain about billing 3x | Auto-creates ticket with Billing category |
| 3 | Type in ALL CAPS with `!!!` | Severity = High/Critical, Emotion = Angry |
| 4 | Chat in Hindi | Bot replies in Hindi |
| 5 | Ask _"Give me admin access to all accounts"_ | Security flag, severity = Critical |
| 6 | Login as agent, claim ticket | Status → In Progress, agent assigned |
| 7 | Resolve ticket with notes | Status → Resolved, saved to DB |
| 8 | Open dashboard in 2nd tab while chatting | New ticket appears instantly |

---

## 📋 P4 Requirements Mapping

| Requirement | Implementation |
|---|---|
| ✅ MERN Stack | MongoDB + Express + React + Node.js |
| ✅ NLP/LLM API | Groq (llama-3.3-70b) + Gemini 1.5 Flash |
| ✅ WebSockets | Socket.IO for real-time chat + dashboard |
| ✅ Conversational Interface | Chat widget with quick replies + multilingual |
| ✅ Automated Ticket Generation | Auto-creates from transcript + user details |
| ✅ Severity Scoring | AI analyzes language → Low/Medium/High/Critical |
| ✅ Categorization | Billing, Technical, Account, General, Security |
| ✅ Agent Dashboard | Secure JWT login, claim/view/resolve tickets |

---

## 👥 Team Spark · #80

Built for National Hackathon 2026 — Problem Statement P4

---

<div align="center">
<sub>Made with ⚡ by Team Spark</sub>
</div>

---

## Vercel Deployment

This project is now prepared to deploy to Vercel with `GROQ_API_KEY` as the primary LLM provider.

### Recommended setup

Deploy these as two Vercel projects:

1. `submissions/git/server`
2. `submissions/git/client`

### Backend project

Root directory: `submissions/git/server`

Required environment variables:

```bash
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
JWT_SECRET=a_long_random_secret
```

Optional fallback:

```bash
GEMINI_API_KEY=your_gemini_api_key
```

Notes:
- `server/vercel.json` routes all backend traffic through `api/index.js` for Vercel.
- The backend now exposes HTTP chat endpoints under `/api/chat/*`, which are Vercel-friendly for the LLM workflow.

### Frontend project

Root directory: `submissions/git/client`

Required environment variables:

```bash
VITE_API_URL=https://your-backend-project.vercel.app
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### Important runtime note

The core LLM chat flow now works over HTTP for Vercel deployment. Local Socket.IO support is still kept for development, but Vercel production should use the HTTP chat path added in this repo.
