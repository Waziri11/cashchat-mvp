import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Debt from '../models/Debt.js';

/**
 * Gets a user by WhatsApp ID, or registers them if they do not exist.
 * @param {string} waId - The sender's WhatsApp ID/phone number.
 * @returns {Promise<object>} The Mongoose user document.
 */
export const getOrCreateUser = async (waId) => {
  try {
    let user = await User.findOne({ waId });
    if (!user) {
      user = new User({ waId });
      await user.save();
      console.log(`[Ledger] Registered new user with waId: ${waId}`);
    }
    return user;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw error;
  }
};

/**
 * Logs a new cashflow transaction.
 * @param {string} userId - The Mongoose ObjectId string of the user.
 * @param {string} type - 'cash_in' or 'cash_out'.
 * @param {number} amount - The transaction amount.
 * @param {string} category - Category like rent, sales, etc.
 * @param {string} description - Summary/Raw text description.
 * @returns {Promise<object>} The created transaction.
 */
export const logTransaction = async (userId, type, amount, category, description) => {
  try {
    const transaction = new Transaction({
      userId: new mongoose.Types.ObjectId(userId),
      type,
      amount,
      category,
      description
    });
    await transaction.save();
    console.log(`[Ledger] Saved transaction: ${type} of $${amount} for user: ${userId}`);
    return transaction;
  } catch (error) {
    console.error('Error logging transaction:', error);
    throw error;
  }
};

/**
 * Logs a new debt entry.
 * @param {string} userId - The user's Mongoose ObjectId.
 * @param {string} customerName - The person who owes the money.
 * @param {number} amount - The debt amount.
 * @param {Date} [dueDate] - Optional due date for the debt.
 * @returns {Promise<object>} The created debt document.
 */
export const logDebt = async (userId, customerName, amount, dueDate = null) => {
  try {
    const debt = new Debt({
      userId: new mongoose.Types.ObjectId(userId),
      customerName,
      amount,
      status: 'unpaid',
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // defaults to 30 days
    });
    await debt.save();
    console.log(`[Ledger] Saved debt: ${customerName} owes $${amount} to user: ${userId}`);
    return debt;
  } catch (error) {
    console.error('Error logging debt:', error);
    throw error;
  }
};

/**
 * Aggregates net cashflow balance (today's cash_in minus cash_out).
 * @param {string} userId - The user's Mongoose ObjectId.
 * @returns {Promise<object>} Object with cashIn, cashOut, and netBalance.
 */
export const queryBalance = async (userId) => {
  try {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const result = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startOfToday }
        }
      },
      {
        $group: {
          _id: null,
          totalCashIn: {
            $sum: {
              $cond: [{ $eq: ['$type', 'cash_in'] }, '$amount', 0]
            }
          },
          totalCashOut: {
            $sum: {
              $cond: [{ $eq: ['$type', 'cash_out'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    const totalCashIn = result[0]?.totalCashIn || 0;
    const totalCashOut = result[0]?.totalCashOut || 0;
    const netBalance = totalCashIn - totalCashOut;

    return {
      totalCashIn,
      totalCashOut,
      netBalance
    };
  } catch (error) {
    console.error('Error querying balance:', error);
    throw error;
  }
};

/**
 * Queries active unpaid debts grouped by customerName.
 * @param {string} userId - The user's Mongoose ObjectId.
 * @returns {Promise<Array>} Array of grouped debts: { customerName, totalOwed }.
 */
export const queryDebt = async (userId) => {
  try {
    const result = await Debt.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: { $in: ['unpaid', 'partially_paid'] }
        }
      },
      {
        $group: {
          _id: '$customerName',
          totalOwed: { $sum: '$amount' }
        }
      },
      {
        $sort: { totalOwed: -1 }
      }
    ]);

    return result.map(item => ({
      customerName: item._id,
      totalOwed: item.totalOwed
    }));
  } catch (error) {
    console.error('Error querying debt:', error);
    throw error;
  }
};
