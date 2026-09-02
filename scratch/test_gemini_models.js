import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const candidateModels = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview'
];

async function checkModels() {
  for (const model of candidateModels) {
    try {
      console.log(`Trying model: ${model}...`);
      const res = await ai.models.generateContent({
        model: model,
        contents: 'Say hello in 3 words'
      });
      console.log(`✅ Success with ${model}:`, res.text.trim());
      return model;
    } catch (e) {
      console.log(`❌ Failed with ${model}:`, e.message);
    }
  }
}

checkModels();
