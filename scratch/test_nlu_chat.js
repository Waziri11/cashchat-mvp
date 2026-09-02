import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { parseIntent } from '../services/nluService.js';
import {
  getOrCreateUser,
  logTransaction,
  logDebt,
  queryBalance,
  queryDebt
} from '../services/ledgerService.js';

dotenv.config();

async function testFullChatFlow() {
  await connectDB();
  const testUserId = 'test_web_demo_888';
  const user = await getOrCreateUser(testUserId);

  console.log('\n1. Testing "Sold 4 shirts for $80"');
  const nlu1 = await parseIntent('Sold 4 shirts for $80');
  console.log('NLU Result 1:', nlu1);
  if (nlu1.intent === 'LOG_TRANSACTION') {
    await logTransaction(user._id, nlu1.transaction_type || 'cash_in', nlu1.amount, nlu1.category, 'Sold 4 shirts for $80');
  }

  console.log('\n2. Testing "Paid $25 for fuel"');
  const nlu2 = await parseIntent('Paid $25 for fuel');
  console.log('NLU Result 2:', nlu2);
  if (nlu2.intent === 'LOG_TRANSACTION') {
    await logTransaction(user._id, nlu2.transaction_type || 'cash_out', nlu2.amount, nlu2.category, 'Paid $25 for fuel');
  }

  console.log('\n3. Testing "David owes me $40"');
  const nlu3 = await parseIntent('David owes me $40');
  console.log('NLU Result 3:', nlu3);
  if (nlu3.intent === 'LOG_DEBT') {
    await logDebt(user._id, nlu3.customer_name || 'David', nlu3.amount);
  }

  console.log('\n4. Testing "What is my balance?"');
  const nlu4 = await parseIntent('What is my balance?');
  console.log('NLU Result 4:', nlu4);
  const balance = await queryBalance(user._id);
  console.log('Query Balance Result:', balance);

  console.log('\n5. Testing "Who owes me money?"');
  const nlu5 = await parseIntent('Who owes me money?');
  console.log('NLU Result 5:', nlu5);
  const debts = await queryDebt(user._id);
  console.log('Query Debts Result:', debts);

  console.log('\n🎉 End-to-end chat flow test completed successfully!');
  process.exit(0);
}

testFullChatFlow().catch(err => {
  console.error('Chat test failed:', err);
  process.exit(1);
});
