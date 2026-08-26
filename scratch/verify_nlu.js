import dotenv from 'dotenv';
import { parseIntent } from '../services/nluService.js';

dotenv.config();

const runNluTest = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.error('❌ Error: GEMINI_API_KEY is not defined in .env! Cannot run NLU test.');
    process.exit(1);
  }

  console.log('⚡ Starting Gemini NLU Parsing Integration Test...');

  const testPhrases = [
    {
      phrase: 'I sold custom inventory for 250 dollars today',
      expectedIntent: 'LOG_TRANSACTION'
    },
    {
      phrase: 'Spent 45.00 on rent payment',
      expectedIntent: 'LOG_TRANSACTION'
    },
    {
      phrase: 'Remind me that Sarah Connor owes me 150.00 for inventory supplies',
      expectedIntent: 'LOG_DEBT'
    },
    {
      phrase: 'how much money did I make today? What is my balance?',
      expectedIntent: 'QUERY_BALANCE'
    },
    {
      phrase: 'list all unpaid customer debts',
      expectedIntent: 'QUERY_DEBT'
    }
  ];

  for (const item of testPhrases) {
    console.log(`\nTesting phrase: "${item.phrase}"`);
    try {
      const result = await parseIntent(item.phrase);
      console.log(`Parsed result:`);
      console.log(`- Intent: ${result.intent}`);
      console.log(`- Transaction Type: ${result.transaction_type}`);
      console.log(`- Amount: ${result.amount}`);
      console.log(`- Category: ${result.category}`);
      console.log(`- Customer Name: ${result.customer_name}`);
      console.log(`- Summary: "${result.summary}"`);

      if (result.intent === item.expectedIntent) {
        console.log(`✅ MATCHED expected intent: ${item.expectedIntent}`);
      } else {
        console.warn(`⚠️ MISMATCHED intent. Expected: ${item.expectedIntent}, Got: ${result.intent}`);
      }
    } catch (error) {
      console.error(`❌ Failed to parse phrase:`, error.message);
    }
  }

  console.log('\nNLU Test finished.');
};

runNluTest();
