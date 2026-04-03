const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Agent = require('../models/Agent');

const agents = [
  { name: 'Rakesh', email: 'rakesh@smartdesk.dev', password: 'agent123' },
  { name: 'Ujjwal', email: 'ujjwal@smartdesk.dev', password: 'agent123' },
  { name: 'Adi', email: 'adi@smartdesk.dev', password: 'agent123' },
  { name: 'Agent One', email: 'agent1@support.com', password: 'password123' },
  { name: 'Agent Two', email: 'agent2@support.com', password: 'password123' }
];

const seedAgents = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    for (const agent of agents) {
      const exists = await Agent.findOne({ email: agent.email });
      if (exists) {
        console.log(`⏭️  Agent ${agent.email} already exists, skipping`);
        continue;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(agent.password, salt);

      await Agent.create({
        name: agent.name,
        email: agent.email,
        password: hashedPassword
      });
      console.log(`✅ Created agent: ${agent.email}`);
    }

    console.log('🎉 Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    process.exit(1);
  }
};

seedAgents();
