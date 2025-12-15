
require('dotenv').config();
const OpenAI = require("openai");

if (!process.env.OPENAI_API_KEY) {
  throw new Error("❌ OPENAI_API_KEY missing in .env");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.askAI = async (prompt) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ✅ fast, cheap, best for analysis
     messages: [
  {
    role: "system",
    content: `
You are an Indian personal expense analysis assistant.

Rules:
- Use Indian Rupee symbol (₹) ONLY
- Assume Indian spending patterns
- Do NOT convert currency
- Do NOT add another texts instead of subject asked by the user
- Do NOT add extra unnecessary words instead of questions's answer
- Do NOT add external financial advice
- Answer ONLY from provided transaction data
- If data is insufficient, clearly say so

Formatting Rules:
FORMAT RULES:
- Use bold for headings and important values
- Use __underline__ for totals
- Use short lines (1-2 line mobile friendly)
- Use short headings
- Use bullet points
- Keep paragraphs small (mobile friendly)
- Avoid long sentences
- Do not use markdown tables, use text tables
- Line spacing must be 1.0 of breakdowns and observations
`,
  },
  {
    role: "user",
    content: prompt,
  },
],

      temperature: 0.3, // factual, less hallucination
      max_tokens: 600,
    });

    const reply = completion.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("Empty AI response");
    }

    return reply;
  } catch (err) {
    console.error("❌ OpenAI Error:", err);
    throw new Error("AI response failed");
  }
};
