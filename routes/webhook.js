import express from 'express';
import dotenv from 'dotenv';
import { getOrCreateUser, logTransaction, logDebt, queryBalance, queryDebt } from '../services/ledgerService.js';
import { parseIntent } from '../services/nluService.js';
import { transcribeAudio } from '../services/transcriptionService.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';

dotenv.config();
const router = express.Router();

/**
 * GET /webhook
 * Meta Webhook Verification
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const localVerifyToken = process.env.META_WA_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === localVerifyToken) {
    console.log('[Webhook] Handshake successful. Webhook verified.');
    return res.status(200).send(challenge);
  } else {
    console.warn('[Webhook] Handshake verification failed: Token mismatch.');
    return res.sendStatus(403);
  }
});

/**
 * POST /webhook
 * Ingest WhatsApp message payloads
 */
router.post('/webhook', (req, res) => {
  const body = req.body;

  // Check if it is a WhatsApp business webhook
  if (body.object !== 'whatsapp_business_account') {
    return res.sendStatus(404);
  }

  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  // If there are no messages (status reports, read receipts), acknowledge and return 200
  if (!value || !value.messages || value.messages.length === 0) {
    return res.status(200).send('EVENT_RECEIVED');
  }

  // Acknowledge receipt to Meta immediately (< 2s) to prevent retries
  res.status(200).send('EVENT_RECEIVED');

  // Process message asynchronously in the background
  (async () => {
    try {
      const message = value.messages[0];
      const waId = message.from;
      const phoneId = value.metadata?.phone_number_id;
      const type = message.type;

      console.log(`[Webhook] Received message of type: ${type} from waId: ${waId}`);

      let text = '';

      if (type === 'text') {
        text = message.text?.body;
      } else if (type === 'audio') {
        const mediaId = message.audio?.id;
        if (!mediaId) {
          throw new Error('Audio object lacks a valid media ID.');
        }
        // Download and transcribe audio using Groq Whisper
        text = await transcribeAudio(mediaId);
      } else {
        console.log(`[Webhook] Unrecognized message type: ${type}. Notifying user.`);
        await sendWhatsAppMessage(
          phoneId,
          waId,
          "👋 Hi! CashChat currently only understands text messages and voice notes."
        );
        return;
      }

      if (!text || text.trim() === '') {
        console.warn('[Webhook] Message text is empty after processing. Ignoring.');
        return;
      }

      // Step 1: Retrieve or register the user
      const user = await getOrCreateUser(waId);

      // Step 2: Use Gemini NLU parser to understand intent & extract data
      const parsedData = await parseIntent(text);

      let replyText = '';

      // Step 3: Direct flow based on extracted intent
      switch (parsedData.intent) {
        case 'LOG_TRANSACTION': {
          const transType = parsedData.transaction_type || 'cash_in';
          await logTransaction(
            user._id,
            transType,
            parsedData.amount,
            parsedData.category,
            text
          );
          replyText = parsedData.summary;
          break;
        }

        case 'LOG_DEBT': {
          const custName = parsedData.customer_name || 'Valued Customer';
          await logDebt(
            user._id,
            custName,
            parsedData.amount
          );
          replyText = parsedData.summary;
          break;
        }

        case 'QUERY_BALANCE': {
          const balanceData = await queryBalance(user._id);
          replyText = `📊 *Today's Balance Summary*:\n\n` +
            `💵 Cash In: $${balanceData.totalCashIn.toFixed(2)}\n` +
            `💸 Cash Out: $${balanceData.totalCashOut.toFixed(2)}\n` +
            `━━━━━━━━━━━━━━\n` +
            `💰 *Net Balance: $${balanceData.netBalance.toFixed(2)}*`;
          break;
        }

        case 'QUERY_DEBT': {
          const debts = await queryDebt(user._id);
          if (debts.length === 0) {
            replyText = `🎉 *Good news!* You have no outstanding customer debts.`;
          } else {
            replyText = `📌 *Outstanding Customer Debts*:\n\n`;
            debts.forEach(debt => {
              replyText += `👤 *${debt.customerName}*: owes $${debt.totalOwed.toFixed(2)}\n`;
            });
          }
          break;
        }

        default:
          replyText = parsedData.summary || "I didn't quite capture that. Please try again.";
      }

      // Step 4: Outbound message back to WhatsApp user
      await sendWhatsAppMessage(phoneId, waId, replyText);

    } catch (error) {
      console.error('[Webhook Process Error]:', error);
      // Attempt to send a friendly notification to the user
      try {
        const message = value.messages?.[0];
        const waId = message?.from;
        const phoneId = value.metadata?.phone_number_id;
        if (waId && phoneId) {
          await sendWhatsAppMessage(
            phoneId,
            waId,
            "⚠️ Sorry, I ran into an error processing your request. Please try again later!"
          );
        }
      } catch (replyError) {
        console.error('Failed to deliver error message to user:', replyError);
      }
    }
  })();
});

export default router;
