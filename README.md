# CashChat MVP

**CashChat** is a free-tier, conversational cashflow and ledger bot built exclusively for WhatsApp. It allows users to record transactions and track customer debts using text messages or voice notes.

## Tech Stack
- **Backend:** Node.js (Express.js)
- **Database:** MongoDB Atlas with Mongoose ORM
- **Voice-to-Text:** Groq Whisper API (`whisper-large-v3`)
- **NLP & Intent Parser:** Google Gemini 2.5 Flash API (Structured JSON Output via `@google/genai`)
- **Messaging Channel:** Meta WhatsApp Cloud API (Webhook)

## Setup & Running
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Configure your API keys in a `.env` file (see `.env` template).
4. Run `npm start` or `npm run dev`.
5. Expose your server using `ngrok` (e.g., `ngrok http 3000`) and set up your Meta Webhook URL to point to `https://<your-ngrok-subdomain>.ngrok-free.app/webhook`.

For detailed setup instructions, refer to `walkthrough.md`.
