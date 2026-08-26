import FormData from 'form-data';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Downloads audio from WhatsApp and transcribes it using Groq's Whisper API.
 * @param {string} mediaId - The WhatsApp Media ID of the audio file.
 * @returns {Promise<string>} The transcribed text.
 */
export const transcribeAudio = async (mediaId) => {
  const waToken = process.env.META_WA_TOKEN;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!waToken) {
    throw new Error('META_WA_TOKEN is not configured.');
  }
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  try {
    // Step 1: Fetch media URL using Media ID
    console.log(`[Transcription] Fetching media metadata for ID: ${mediaId}`);
    const mediaMetadata = await axios.get(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${waToken}`
        }
      }
    );

    const downloadUrl = mediaMetadata.data.url;
    if (!downloadUrl) {
      throw new Error(`Media metadata did not return a valid download URL for ID: ${mediaId}`);
    }

    // Step 2: Download the audio media file as a buffer
    console.log(`[Transcription] Downloading audio file from URL`);
    const audioDownload = await axios.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${waToken}`,
        'User-Agent': 'curl/7.64.1' // User-agent to prevent requests from being blocked
      },
      responseType: 'arraybuffer'
    });

    const audioBuffer = Buffer.from(audioDownload.data);

    // Step 3: Package form data and send to Groq API
    console.log(`[Transcription] Sending audio buffer to Groq Whisper API`);
    const form = new FormData();
    // Groq requires a filename with a recognized audio extension (e.g. .ogg, .wav, .mp3)
    form.append('file', audioBuffer, {
      filename: 'whatsapp_voice.ogg',
      contentType: 'audio/ogg'
    });
    form.append('model', 'whisper-large-v3');

    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${groqApiKey}`
        }
      }
    );

    const text = groqResponse.data.text;
    console.log(`[Transcription] Success: "${text}"`);
    return text;
  } catch (error) {
    console.error('Error during audio download or transcription:', error.response?.data || error.message);
    throw error;
  }
};
