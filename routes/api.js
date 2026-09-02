import express from 'express';
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
import { parseIntent } from '../services/nluService.js';

const router = express.Router();

/**
 * Helper to construct user stats & ledger overview
 */
async function fetchUserLedgerOverview(userId) {
  const [balance, groupedDebts, debtsList, transactions] = await Promise.all([
    queryBalance(userId),
    queryDebt(userId),
    getDebtsList(userId),
    getRecentTransactions(userId, 20)
  ]);

  return {
    balance,
    groupedDebts,
    debtsList,
    transactions
  };
}

/**
 * POST /api/chat
 * Send a conversational message to CashChat
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, userId = 'demo_user_123', businessName } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }

    // Step 1: Retrieve or register user
    const user = await getOrCreateUser(userId);
    if (businessName && !user.businessName) {
      user.businessName = businessName;
      await user.save();
    }

    const trimmedText = message.trim();

    // Step 2: Extract Intent with Gemini NLU
    const parsedData = await parseIntent(trimmedText);

    let replyText = '';
    let actionResult = null;

    // Step 3: Perform action based on detected intent
    switch (parsedData.intent) {
      case 'LOG_TRANSACTION': {
        const transType = parsedData.transaction_type || 'cash_in';
        actionResult = await logTransaction(
          user._id,
          transType,
          parsedData.amount,
          parsedData.category,
          trimmedText
        );
        replyText = parsedData.summary || `Logged ${transType === 'cash_in' ? 'income' : 'expense'} of $${parsedData.amount}`;
        break;
      }

      case 'LOG_DEBT': {
        const custName = parsedData.customer_name || 'Valued Customer';
        actionResult = await logDebt(
          user._id,
          custName,
          parsedData.amount
        );
        replyText = parsedData.summary || `Logged debt: ${custName} owes $${parsedData.amount}`;
        break;
      }

      case 'QUERY_BALANCE': {
        const balanceData = await queryBalance(user._id);
        replyText = `📊 **Today's Balance Summary**\n\n` +
          `💵 **Cash In:** $${balanceData.totalCashIn.toFixed(2)}\n` +
          `💸 **Cash Out:** $${balanceData.totalCashOut.toFixed(2)}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💰 **Net Balance: $${balanceData.netBalance.toFixed(2)}**`;
        break;
      }

      case 'QUERY_DEBT': {
        const debts = await queryDebt(user._id);
        if (debts.length === 0) {
          replyText = `🎉 **Good news!** You currently have no outstanding customer debts.`;
        } else {
          replyText = `📌 **Outstanding Customer Debts**:\n\n` +
            debts.map(d => `👤 **${d.customerName}**: owes **$${d.totalOwed.toFixed(2)}**`).join('\n');
        }
        break;
      }

      default:
        replyText = parsedData.summary || "I didn't quite understand that. Try saying something like 'Sold 3 shirts for $45' or 'What is my balance?'.";
    }

    // Step 4: Fetch updated overview to return live status
    const ledgerOverview = await fetchUserLedgerOverview(user._id);

    return res.json({
      success: true,
      reply: replyText,
      intent: parsedData.intent,
      parsedData,
      actionResult,
      overview: ledgerOverview
    });

  } catch (error) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error'
    });
  }
});

/**
 * GET /api/ledger/overview
 * Get current balance, debts, and transactions for the live sidebar
 */
router.get('/ledger/overview', async (req, res) => {
  try {
    const userId = req.query.userId || 'demo_user_123';
    const user = await getOrCreateUser(userId);
    const overview = await fetchUserLedgerOverview(user._id);

    return res.json({
      success: true,
      user: {
        id: user._id,
        waId: user.waId,
        businessName: user.businessName
      },
      ...overview
    });
  } catch (error) {
    console.error('Error fetching ledger overview:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ledger/settle
 * Mark a debt as settled
 */
router.post('/ledger/settle', async (req, res) => {
  try {
    const { debtId, userId = 'demo_user_123' } = req.body;
    if (!debtId) {
      return res.status(400).json({ success: false, error: 'debtId is required.' });
    }

    const updatedDebt = await settleDebt(debtId);
    const user = await getOrCreateUser(userId);
    const overview = await fetchUserLedgerOverview(user._id);

    return res.json({
      success: true,
      message: 'Debt marked as settled.',
      updatedDebt,
      overview
    });
  } catch (error) {
    console.error('Error settling debt:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ledger/reset
 * Reset demo data for testing
 */
router.post('/ledger/reset', async (req, res) => {
  try {
    const { userId = 'demo_user_123' } = req.body;
    const user = await getOrCreateUser(userId);
    await resetUserData(user._id);
    const overview = await fetchUserLedgerOverview(user._id);

    return res.json({
      success: true,
      message: 'Ledger reset successfully.',
      overview
    });
  } catch (error) {
    console.error('Error resetting ledger:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
