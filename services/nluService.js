import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Gemini client using the new standard SDK
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not defined in environment variables.');
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Extracts intent and entity structured data from the user message.
 * @param {string} text - The raw text message (or transcribed voice message) from the user.
 * @returns {Promise<object>} The parsed JSON data matching the user's intent.
 */
export const parseIntent = async (text) => {
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  const systemInstruction = `
    You are the NLU parser engine for CashChat, a conversational cashflow and ledger bot.
    Your task is to analyze the user message and extract structured transaction or debt details.
    
    Examine the input message and map it to one of the following intents:
    1. LOG_TRANSACTION: Recording income/sales (cash_in) or expenses/purchases/payments (cash_out).
    2. LOG_DEBT: Recording when someone owes the user money, or the user owes someone money.
    3. QUERY_BALANCE: Checking their today's cash flow, total made today, or net balance today.
    4. QUERY_DEBT: Asking about who owes them money, general debts list, or status of debts.
    
    Ensure transaction_type is strictly 'cash_in', 'cash_out', or 'null'.
    Ensure category is strictly one of: 'inventory', 'sales', 'rent', 'utility', 'debt', 'custom'.
    Identify customer_name if a person's name is mentioned in relation to a debt or transaction (e.g., "John owes me" -> customer_name: "John"). If no name is mentioned, set it to "null".
    Determine a short, warm, and friendly confirmation summary in the user's language.
  `;

  try {
    console.log(`[NLU] Sending prompt to Gemini (${model}): "${text}"`);
    const response = await ai.models.generateContent({
      model: model,
      contents: text,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            intent: {
              type: 'STRING',
              enum: ['LOG_TRANSACTION', 'LOG_DEBT', 'QUERY_BALANCE', 'QUERY_DEBT'],
              description: 'The detected user intent.'
            },
            transaction_type: {
              type: 'STRING',
              enum: ['cash_in', 'cash_out', 'null'],
              description: 'The transaction flow type. Must be null if intent is not LOG_TRANSACTION.'
            },
            amount: {
              type: 'NUMBER',
              description: 'The monetary amount mentioned. Default to 0.0 if not specified.'
            },
            category: {
              type: 'STRING',
              enum: ['inventory', 'sales', 'rent', 'utility', 'debt', 'custom'],
              description: 'The transaction or debt category.'
            },
            customer_name: {
              type: 'STRING',
              description: 'The name of the customer involved in the debt/transaction, or the string "null" if none.'
            },
            summary: {
              type: 'STRING',
              description: 'A brief 1-sentence confirmation message in the user\'s language summarizing what will happen.'
            }
          },
          required: ['intent', 'transaction_type', 'amount', 'category', 'customer_name', 'summary']
        }
      }
    });

    const parsedData = JSON.parse(response.text);
    console.log(`[NLU] Parsed output:`, parsedData);

    // Normalize output values
    if (parsedData.transaction_type === 'null' || parsedData.transaction_type === 'NULL') {
      parsedData.transaction_type = null;
    }
    if (parsedData.customer_name === 'null' || parsedData.customer_name === 'NULL' || parsedData.customer_name === '') {
      parsedData.customer_name = null;
    }
    if (typeof parsedData.amount !== 'number') {
      parsedData.amount = parseFloat(parsedData.amount) || 0.0;
    }

    return parsedData;
  } catch (error) {
    console.error('Error during NLU parsing:', error);
    // Return a fallback object so the application doesn't crash
    return {
      intent: 'LOG_TRANSACTION',
      transaction_type: 'cash_in',
      amount: 0.0,
      category: 'custom',
      customer_name: null,
      summary: 'Sorry, I couldn\'t parse that message. Could you try rephrasing it?'
    };
  }
};
