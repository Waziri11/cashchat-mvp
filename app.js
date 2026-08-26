import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import webhookRouter from './routes/webhook.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Express Body Parser Middleware
app.use(express.json());

// Health Check Endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'active', service: 'CashChat MVP Backend' });
});

// Mount Webhook Router
app.use('/', webhookRouter);

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 CashChat MVP Server is running on port ${PORT}`);
  console.log(`📍 Webhook Verification URL: http://localhost:${PORT}/webhook`);
  console.log(`===============================================`);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});
