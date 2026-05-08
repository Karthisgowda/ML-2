<div align="center">

# SmartDesk

An end-to-end support portal that uses **AI chatbot deflection**, **automated ticket routing**, and a **real-time agent dashboard** to reduce manual ticket sorting and improve resolution time

SmartDesk is a full-stack support portal that combines an AI-first customer chat experience, automatic ticket escalation, severity classification, security-risk detection, and a real-time agent dashboard.

[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=111)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Realtime](https://img.shields.io/badge/Realtime-Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![AI](https://img.shields.io/badge/AI-Groq%20%2B%20Gemini-FF6B6B?style=for-the-badge)](#ai-workflow)

</div>

---

## Overview

SmartDesk is designed for customer support teams that need to reduce repetitive manual triage while still giving users a clear escalation path to human agents. Customers can sign in with Google or continue as a guest, start a support conversation, receive instant AI-guided help, and automatically create a ticket when the issue needs human intervention.

Agents sign in through a separate dashboard where they can view, filter, claim, update, and export tickets. New tickets and ticket updates are broadcast to connected agent dashboards through Socket.IO when the Node server is running locally.

## Problem Statement

Support teams spend significant time handling repeated Level-1 questions, sorting complaints, identifying urgency, and deciding which cases require human action. This slows response time for important issues and creates inconsistent handoffs between the chatbot and human agents.

SmartDesk addresses this by making the AI assistant the first support touchpoint, while still preserving structured escalation, ticket history, agent briefing, severity scoring, and dashboard visibility.

## Solution Overview

SmartDesk provides:

| Capability | Implementation |
| --- | --- |
| Customer support entry point | Landing page with Google OAuth redirect flow and guest sign-in |
| AI support chat | HTTP chat endpoint with FAQ matching, LLM processing, and fallback classification |
| Ticket escalation | Automatic ticket creation based on unresolved issues, high severity, repeated messages, manual escalation, or security flags |
| Agent workspace | Protected dashboard with ticket cards, filters, analytics, modal details, status workflow, and exports |
| Real-time updates | Socket.IO rooms for agent dashboards and direct agent-to-user messages |
| Persistence | MongoDB with Mongoose models; in-memory fallback for demo/reduced functionality |

## Key Features

### Customer Experience

- Landing page with SmartDesk branding and light/dark theme toggle.
- Google sign-in using OAuth access token and Google user profile lookup.
- Guest support flow using name and email stored in `sessionStorage`.
- My Tickets page for customers to review ticket status by email.
- Ticket cancellation for customer-owned tickets that are not already resolved or closed.
- Chat reset and session clearing through the backend.

### AI Chatbot

- FAQ-first matching for common questions such as password reset, refund status, order tracking, profile updates, pricing, subscription cancellation, app crashes, payment failures, and human-agent requests.
- Groq-powered primary LLM classification when `GROQ_API_KEY` is configured.
- Gemini fallback when `GEMINI_API_KEY` is configured.
- Keyword classifier fallback when LLM providers are unavailable or fail.
- Suggested reply pills returned by the AI response.
- Sentiment score and visible emotion indicator in the chat UI.
- Manual escalation through the **Talk to Human** action.

### Ticket Management

- Automatic ticket IDs such as `TKT-...` for MongoDB tickets and `TKT-MEM-...` for in-memory demo tickets.
- Ticket metadata includes category, severity, emotion, urgency, security flag, summary, transcript, assigned agent, resolution notes, and AI agent briefing.
- Supported ticket statuses: `open`, `in-progress`, `resolved`, and `closed`.
- Customer ticket list with status filters and local ticket cache.
- Agent ticket list sorted by security flag, severity, and creation time.

### Agent Dashboard

- JWT-protected agent login.
- Dashboard cards for open, in-progress, resolved, high-priority, and security-flagged tickets.
- Status and severity filters.
- Optional analytics section with Recharts pie and bar charts.
- Ticket modal with customer details, AI summary, AI briefing, transcript, status workflow, direct reply box, and resolution notes.
- Claim workflow that assigns the current agent and moves a ticket to `in-progress`.
- Export support for CSV, PDF, and Excel files.

## AI Workflow

SmartDesk uses a layered AI workflow:

1. The customer submits a message through the chat UI.
2. The backend loads or creates the customer's chat session.
3. The message is checked against the local FAQ knowledge base.
4. If no FAQ match is found, Groq is attempted first using `llama-3.3-70b-versatile`.
5. If Groq fails or is unavailable, Gemini is attempted using `gemini-1.5-flash`.
6. If both LLM providers are unavailable, the keyword fallback classifier is used.
7. The response is normalized to include empathy, likely cause, and practical next steps.
8. If escalation criteria are met, a ticket is created with transcript and AI metadata.
9. A separate AI-generated agent briefing is attempted for escalated tickets.
10. Connected agent dashboards receive `new_ticket` events when Socket.IO is active.

```mermaid
flowchart TD
  A[Customer sends message] --> B[Load or create chat session]
  B --> C{FAQ match?}
  C -- Yes --> D[Return FAQ answer and metadata]
  C -- No --> E{Groq configured?}
  E -- Yes --> F[Process with Groq LLM]
  E -- No --> G{Gemini configured?}
  F -- Fails --> G
  G -- Yes --> H[Process with Gemini]
  G -- No --> I[Keyword fallback classifier]
  H -- Fails --> I
  D --> J[Normalize support response]
  F --> J
  H --> J
  I --> J
  J --> K{Escalation needed?}
  K -- No --> L[Persist chat session]
  K -- Yes --> M[Create ticket and agent briefing]
  M --> N[Emit new_ticket to agent room]
  L --> O[Return chat response]
  N --> O
```

## Severity Scoring System

Severity is produced by the LLM response schema or the fallback classifier.

| Severity | When it is used |
| --- | --- |
| `Low` | Informational or simple issues that can be answered directly. |
| `Medium` | Normal unresolved issues or manual human-agent requests from low-risk conversations. |
| `High` | Blocked access, repeated failures, strong frustration, urgent wording, or same-day business impact. |
| `Critical` | Account compromise, data exposure, fraud risk, active money loss, security attacks, or legal/threatening language. |

Fallback severity logic checks for:

- Billing, technical, and account keywords.
- Security-related keywords such as `admin`, `root`, `hack`, `exploit`, `bypass`, `sudo`, `sql`, `drop table`, `social engineering`, and `phishing`.
- Angry or desperate language.
- More than 50% uppercase letters in the message.
- Multiple exclamation marks as an urgency signal.

## Emotion Detection System

Ticket emotion is stored as one of:

| Emotion | Signals |
| --- | --- |
| `Calm` | Neutral or routine support requests. |
| `Frustrated` | Words such as `frustrated`, `annoying`, `unacceptable`, `ugh`, or `come on`. |
| `Angry` | Strong negative language, insults, profanity, or heavy uppercase usage. |
| `Desperate` | Urgent help requests such as `please help`, `urgent`, `emergency`, `asap`, or `right now`. |
| `Threatening` | Legal, public complaint, or threat language such as `lawsuit`, `lawyer`, `sue`, or `court`. |

The chat UI displays the current emotion and a sentiment meter based on the AI or fallback response.

## Security Threat Detection

SmartDesk flags security-risk conversations through both the LLM classification rules and fallback keyword detection. When a security signal is detected:

- `category` is set to `Security`.
- `securityFlag` is set to `true`.
- `severity` becomes `Critical`.
- `urgency` becomes `Immediate`.
- The ticket is prioritized in the agent dashboard sorting.
- The ticket card and modal display a security flag.

This is implemented for signals such as suspicious access requests, phishing, bypass attempts, exploit language, SQL-related attack terms, and unauthorized privilege requests.

## Authentication and Authorization Flow

SmartDesk has two authentication paths:

| User type | Flow |
| --- | --- |
| Customer | Google OAuth redirect or guest name/email entry. Customer identity is stored in `sessionStorage` for the frontend flow. Google users receive a backend JWT stored in `sessionStorage` as `token`. |
| Agent | Email/password login through `/api/agents/login`. Passwords are compared with bcrypt hashes. A JWT is stored in `localStorage` as `agentToken`. Protected agent API calls use `Authorization: Bearer <token>`. |

## Detailed Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend framework | React 19 with Vite |
| Routing | React Router DOM 7 |
| Styling | CSS Modules and global CSS |
| Charts | Recharts |
| HTTP client | Axios and Fetch |
| Real-time client | Socket.IO Client |
| Export libraries | jsPDF, jspdf-autotable, xlsx |
| OAuth client | `@react-oauth/google` plus manual Google OAuth redirect handling |
| Backend runtime | Node.js |
| API framework | Express 5 |
| Real-time server | Socket.IO |
| Database | MongoDB |
| ODM | Mongoose |
| Authentication | JWT and bcryptjs |
| Google token/profile support | google-auth-library and Google UserInfo API |
| Primary AI provider | Groq SDK with `llama-3.3-70b-versatile` |
| Fallback AI provider | Google Gemini with `gemini-1.5-flash` |
| Offline fallback | Local keyword classifier |
| Deployment config | Separate Vercel configs for `client` and `server` |

## Environment Variables

### Backend (`server/.env`)

```env
MONGO_URI=your_mongodb_uri
GROQ_API_KEY=your_groq_key
JWT_SECRET=your_secret
```
### Frontend: `client/.env`
```
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Setup and Installation

### Prerequisites

- Node.js 18 or newer
- npm
- MongoDB Atlas or a local MongoDB-compatible connection string
- Optional Groq and Gemini API keys for AI provider support
- Google OAuth client ID for Google sign-in

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Chat-agent
```

### 2. Configure the Backend

```bash
cd server
npm install
copy .env.example .env
```

Update `server/.env` with your MongoDB URI, JWT secret, Google client ID, and optional AI keys.

Seed demo agents into MongoDB:

```bash
npm run seed
```

Start the local backend with Socket.IO:

```bash
npm run dev
```

The backend runs at `http://localhost:5000` by default.

### 3. Configure the Frontend

Open a second terminal:

```bash
cd client
npm install
copy .env.example .env
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## License

This project is licensed under the ISC license as declared in `server/package.json`.

