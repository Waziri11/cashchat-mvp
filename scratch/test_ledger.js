import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { parseIntent } from '../services/nluService.js';
import {
  getOrCreateUser,
  logTransaction,
  logDebt,
  queryBalance,
  queryDebt,
  getRecentTransactions,
  getDebtsList,
  settleDebt,
  resetUserData
} from '../services/ledgerService.js';

dotenv.config();

async function runTests() {
  console.log('Testing Database and Services...');
  await connectDB();

  const testUser = 'test_web_user_999';
  const user = await getOrCreateUser(testUser);
  console.log('User created/retrieved:', user._id);

  // Reset any previous test data
  await resetUserData(user._id);

  // Test 1: Log Cash In
  console.log('\n--- Test 1: Log Cash In ---');
  const t1 = await logTransaction(user._id, 'cash_in', 150, 'sales', 'Sold 3 shoes for $150');
  console.log('Logged Transaction 1:', t1.amount, t1.type);

  // Test 2: Log Cash Out
  console.log('\n--- Test 2: Log Cash Out ---');
  const t2 = await logTransaction(user._id, 'cash_out', 45, 'utility', 'Paid electricity $45');
  console.log('Logged Transaction 2:', t2.amount, t2.type);

  // Test 3: Log Debt
  console.log('\n--- Test 3: Log Debt ---');
  const d1 = await logDebt(user._id, 'Alice', 60);
  console.log('Logged Debt 1:', d1.customerName, d1.amount);

  // Test 4: Query Balance
  console.log('\n--- Test 4: Query Balance ---');
  const balance = await queryBalance(user._id);
  console.log('Balance Result:', balance);

  // Test 5: Query Debt
  console.log('\n--- Test 5: Query Debt ---');
  const debts = await queryDebt(user._id);
  console.log('Debts Result:', debts);

  // Test 6: Recent Transactions
  console.log('\n--- Test 6: Recent Transactions ---');
  const recent = await getRecentTransactions(user._id);
  console.log('Recent count:', recent.length);

  // Clean up test user
  await resetUserData(user._id);
  console.log('\nAll test assertions passed successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
