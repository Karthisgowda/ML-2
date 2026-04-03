const bcrypt = require('bcryptjs');

const sessions = new Map();
const tickets = new Map();
let nextTicketCounter = 1;

const demoAgents = [
  { id: 'agent-1', name: 'Rakesh', email: 'rakesh@smartdesk.dev', password: 'agent123' },
  { id: 'agent-2', name: 'Ujjwal', email: 'ujjwal@smartdesk.dev', password: 'agent123' },
  { id: 'agent-3', name: 'Adi', email: 'adi@smartdesk.dev', password: 'agent123' },
];

let hashedAgentsPromise = null;

async function getDemoAgents() {
  if (!hashedAgentsPromise) {
    hashedAgentsPromise = Promise.all(
      demoAgents.map(async (agent) => ({
        ...agent,
        passwordHash: await bcrypt.hash(agent.password, 10),
      }))
    );
  }

  return hashedAgentsPromise;
}

function getSession(email) {
  return sessions.get(email || 'no-email') || { userEmail: email || 'no-email', messages: [] };
}

function setSession(email, session) {
  sessions.set(email || 'no-email', session);
  return session;
}

function clearSession(email) {
  sessions.set(email || 'no-email', { userEmail: email || 'no-email', messages: [] });
}

function createTicket(data) {
  const now = new Date();
  const ticket = {
    _id: `mem-${nextTicketCounter}`,
    ticketId: `TKT-MEM-${String(nextTicketCounter).padStart(4, '0')}`,
    status: 'open',
    assignedAgent: null,
    resolutionNotes: '',
    createdAt: now,
    updatedAt: now,
    ...data,
  };

  nextTicketCounter += 1;
  tickets.set(ticket.ticketId, ticket);
  return ticket;
}

function listTickets() {
  return Array.from(tickets.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findTicket(id) {
  return tickets.get(id) || Array.from(tickets.values()).find((ticket) => ticket._id === id) || null;
}

function updateTicket(id, updates) {
  const ticket = findTicket(id);
  if (!ticket) return null;
  Object.assign(ticket, updates, { updatedAt: new Date() });
  tickets.set(ticket.ticketId, ticket);
  return ticket;
}

function listTicketsByEmail(email) {
  return listTickets().filter((ticket) => ticket.userEmail === email);
}

module.exports = {
  getDemoAgents,
  getSession,
  setSession,
  clearSession,
  createTicket,
  listTickets,
  listTicketsByEmail,
  findTicket,
  updateTicket,
};
