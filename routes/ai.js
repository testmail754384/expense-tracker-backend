const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const { askAI } = require("../utils/openai");
const User = require("../models/User");

router.post("/analyze", authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    /* ---------- USER DETAILS (SAFE) ---------- */
    const user = await User.findById(req.userId).select(
      "name email createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    /* ---------- TRANSACTIONS ---------- */
    const transactions = await Transaction.find(
      { userId: req.userId },
      { receipt: 0 }
    )
      .sort({ date: -1 })
      .limit(200);

    const safeTransactions = transactions.map((tx) => ({
      date: tx.date,
      type: tx.type,
      category: tx.category,
      amount: `₹${tx.amount}`,
      description: tx.description || "",
    }));

     const prompt = `
USER PROFILE:
- Name: ${user.name}
- Email: ${user.email}
- Joined Date: ${user.createdAt.toDateString()}

USER TRANSACTIONS (₹ Indian Rupees only):
${JSON.stringify(safeTransactions, null, 2)}

USER QUESTION:
${message}

RESPONSE FORMAT (STRICT):
1. Short Summary (1–2 lines)
2. Key Observations (bullet points) 
3. Spending Breakdown (₹ values) 
4. Practical Insight (based only on data)
5. Use ₹ symbol only
6. Indian context
7. Short paragraphs
8. Mobile-friendly formatting
9. Answer ONLY from given data
10. You MAY reference user's name, email, and joined date if relevant
11. Keep one line space between paragraphs 
12. Keep no line space between lines


IMPORTANT RULES:
- Do NOT mention AI, model, or system
- Do NOT assume missing data
- Do NOT invent values
- Keep response concise and readable
- Do NOT send the other information instead of actual answer
`;


    const reply = await askAI(prompt);

    res.json({ reply });
  } catch (err) {
    console.error("AI Route Error:", err.message);
    res.status(500).json({ message: "AI failed" });
  }
});

module.exports = router;
