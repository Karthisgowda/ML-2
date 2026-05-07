<div align="center">

# SmartDesk - AI-Powered Complaint Management System

An end-to-end support portal that uses **AI chatbot deflection**, **automated ticket routing**, and a **real-time agent dashboard** to reduce manual ticket sorting and improve resolution time

[![Tech Stack](https://img.shields.io/badge/Stack-MERN-00d9ff?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![AI](https://img.shields.io/badge/AI-LLM_API-ff6b6b?style=for-the-badge&logo=openai&logoColor=white)](https://console.groq.com/)
[![Real-time](https://img.shields.io/badge/Real--time-Socket.IO-34c759?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)

</div>

---

## Problem

Customer support teams are overwhelmed by repetitive L1 queries (_"Where is my refund?"_). This delays resolution of complex, high-priority issues. Companies need a system where an **AI chatbot acts as the first line of defense** and, if it cannot resolve the issue, it seamlessly **logs, categorizes, and routes** the complaint to a human agent

## Solution

SmartDesk provides:

| Layer | What it does |
|---|---|
| **AI Chatbot** | Resolves L1 queries instantly (password resets, FAQs, status checks) |
| **Auto Severity Scoring** | Analyzes user language to assign Low / Medium / High / Critical |
| **Smart Categorization** | Tags tickets: Billing, Technical, Account, General, Security |
| **Emotion Detection** | Detects: Angry, Frustrated, Desperate, Threatening, Calm |
| **Security Flag** | Catches social engineering, phishing, unauthorized access attempts |
| **Agent Dashboard** | Claim tickets, view transcripts, update status, resolve issues |
| **Real-time Updates** | New tickets appear on dashboard instantly via WebSockets |

---

## Architecture

```text
React UI (Vite) <-> Express API + Socket.IO <-> MongoDB / AI Providers
```

### AI Engine - 3-Layer Fallback

1. **Groq API** (`llama-3.3-70b-versatile`) - Primary, fastest inference
2. **Google Gemini** (`gemini-1.5-flash`) - Fallback #1
3. **Keyword Regex** - Fallback #2, always works offline

---

## Key Features

### Conversational AI Chat
- Natural language understanding via LLM
- Quick reply suggestion pills for faster interaction
- Multilingual support
- Live sentiment meter for real-time emotion feedback
- FAQ matching for instant L1 resolution
- Auto-escalation after repeated unresolved messages or high severity

### Smart Ticket Generation
- Automatic ticket creation when AI determines human intervention is needed
- Captures transcript, user details, and AI-classified metadata
- Severity scored from language patterns such as caps, punctuation, and tone
- Security threats flagged and escalated immediately

### Agent Dashboard
- JWT-secured login
- Interactive analytics
- Compact filter controls for status and severity
- Real-time ticket stream via Socket.IO
- Claim -> In Progress -> Resolved workflow
- Full chat transcript viewer in ticket modal
- CSV, PDF, and Excel export support

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, React Router, Recharts, Socket.IO Client |
| **Backend** | Node.js, Express 5, Socket.IO, Mongoose |
| **Database** | MongoDB Atlas |
| **AI/NLP** | Groq SDK, Google Gemini 1.5 Flash |
| **Auth** | JWT, bcryptjs |
| **Real-time** | Socket.IO |

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- At least one AI API key: [Groq](https://console.groq.com/) or [Google AI Studio](https://aistudio.google.com/)

### 1. Clone & Setup

```bash
git clone https://github.com/Karthisgowda/ML-2.git
cd ML-2
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env
npm run seed
npm run dev
```

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

### 4. Open

- Chat: `http://localhost:5173`
- Agent Login: `http://localhost:5173/agent/login`

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Agent | `rakesh@smartdesk.dev` | `agent123` |
| Agent | `ujjwal@smartdesk.dev` | `agent123` |
| Agent | `adi@smartdesk.dev` | `agent123` |

---

## Project Structure

```text
server/
client/
README.md
```

---

## Vercel Deployment

This project is prepared to deploy to Vercel with `GROQ_API_KEY` as the primary LLM provider.

### Recommended setup

Deploy these as two Vercel projects:

1. `server`
2. `client`

### Backend project

Root directory: `server`

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

### Frontend project

Root directory: `client`

Required environment variables:

```bash
VITE_API_URL=https://your-backend-project.vercel.app
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### Important runtime note

The core LLM chat flow works over HTTP for Vercel deployment. Local Socket.IO support is still kept for development, but Vercel production should use the HTTP chat path added in this repo.

## Project Highlights

- Built with a scalable client-server architecture for real-time support operations
- Integrates AI-driven ticket analysis with automated escalation workflows
- Designed to reduce manual support effort and improve response efficiency
- Supports secure agent authentication and live complaint monitoring
- Optimized for modern deployment platforms including Vercel and MongoDB Atlas

## Contributor

This project was collaboratively worked on and maintained with contributions in frontend improvements, documentation updates, and project enhancement support.
