import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Sends a text message to a user via the WhatsApp Cloud API.
 * @param {string} phoneNumberId - The phone number ID from the incoming webhook or env configuration.
 * @param {string} to - The recipient's phone number/WhatsApp ID.
 * @param {string} textBody - The text content of the message.
 * @returns {Promise<object>} The API response data.
 */
export const sendWhatsAppMessage = async (phoneNumberId, to, textBody) => {
  const token = process.env.META_WA_TOKEN;
  const phoneId = phoneNumberId || process.env.META_WA_PHONE_NUMBER_ID;

  if (!token) {
    console.warn('WARNING: META_WA_TOKEN is not defined in environment variables.');
  }

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      preview_url: false,
      body: textBody
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
};
