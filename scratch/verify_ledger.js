import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { getOrCreateUser, logTransaction, logDebt, queryBalance, queryDebt } from '../services/ledgerService.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Debt from '../models/Debt.js';

dotenv.config();

const runTest = async () => {
  console.log('⚡ Starting Ledger Aggregation Integration Test...');

  // 1. Connect to DB
  await connectDB();

  // Clean up any existing test data to ensure clean run
  const testWaId = 'test-whatsapp-id-12345';
  await User.deleteOne({ waId: testWaId });

  try {
    // 2. Register/Fetch User
    const user = await getOrCreateUser(testWaId);
    console.log('✔ User created:', user._id);

    // Clean up relations just in case
    await Transaction.deleteMany({ userId: user._id });
    await Debt.deleteMany({ userId: user._id });

    // 3. Log Transactions (Cash flows)
    console.log('Logging transactions...');
    await logTransaction(user._id, 'cash_in', 150.50, 'sales', 'Sold inventory');
    await logTransaction(user._id, 'cash_in', 300.00, 'sales', 'Sold more items');
    await logTransaction(user._id, 'cash_out', 50.00, 'rent', 'Paid daily rent');
    await logTransaction(user._id, 'cash_out', 20.00, 'utility', 'Electric bill');

    // 4. Log Debts
    console.log('Logging customer debts...');
    await logDebt(user._id, 'Alice Smith', 100.00);
    await logDebt(user._id, 'Bob Jones', 75.00);
    await logDebt(user._id, 'Alice Smith', 50.00); // multiple debts for Alice

    // 5. Query Balance and verify
    console.log('Querying net balance...');
    const balance = await queryBalance(user._id);
    console.log('Balance Result:', balance);

    const expectedCashIn = 450.50;
    const expectedCashOut = 70.00;
    const expectedNet = 380.50;

    if (balance.totalCashIn === expectedCashIn && balance.totalCashOut === expectedCashOut && balance.netBalance === expectedNet) {
      console.log('✅ queryBalance aggregation successfully verified!');
    } else {
      console.error('❌ queryBalance aggregation verification failed!', { expectedCashIn, expectedCashOut, expectedNet, ...balance });
    }

    // 6. Query Debts and verify grouping
    console.log('Querying customer debts grouped...');
    const debts = await queryDebt(user._id);
    console.log('Debts Result:', debts);

    // Alice should have totalOwed = 150 (100 + 50)
    // Bob should have totalOwed = 75
    const aliceRecord = debts.find(d => d.customerName === 'Alice Smith');
    const bobRecord = debts.find(d => d.customerName === 'Bob Jones');

    if (aliceRecord && aliceRecord.totalOwed === 150 && bobRecord && bobRecord.totalOwed === 75) {
      console.log('✅ queryDebt grouping aggregation successfully verified!');
    } else {
      console.error('❌ queryDebt grouping aggregation verification failed!');
    }

    // Clean up
    console.log('Cleaning up test data...');
    await Transaction.deleteMany({ userId: user._id });
    await Debt.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    console.log('✔ Clean up complete.');

  } catch (err) {
    console.error('❌ Error during testing:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 DB Connection closed. Integration test finished.');
  }
};

runTest();
