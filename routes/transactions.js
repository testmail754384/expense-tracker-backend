const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Transaction = require("../models/Transaction");

/* ---------- JWT VERIFY MIDDLEWARE ---------- */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/* ---------- GET TRANSACTIONS ---------- */
/**
 * Default: last 20 transactions
 * Export: ?all=true → ALL transactions
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const limit = req.query.all === "true" ? 0 : 20;

    const transactions = await Transaction.find({
      userId: req.user.id, // ✅ FIXED
    })
      .sort({ date: -1 })
      .limit(limit);

    res.json(transactions);
  } catch (err) {
    console.error("Fetch Transactions Error:", err);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

/* ---------- CREATE TRANSACTION ---------- */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { type, category, amount, date, description, receipt } = req.body;

    if (!type || !category || !amount || !date) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const tx = new Transaction({
      type,
      category,
      amount,
      date,
      description,
      receipt,
      userId: req.user.id, // ✅ FIXED
    });

    await tx.save();
    res.status(201).json(tx);
  } catch (err) {
    console.error("Create Transaction Error:", err);
    res.status(500).json({ message: "Failed to create transaction" });
  }
});

/* ---------- DELETE TRANSACTION ---------- */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const tx = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id, // ✅ FIXED
    });

    if (!tx) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete Transaction Error:", err);
    res.status(500).json({ message: "Failed to delete transaction" });
  }
});

/* ---------- UPDATE TRANSACTION ---------- */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const updatedTx = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id }, // ✅ FIXED
      req.body,
      { new: true }
    );

    if (!updatedTx) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json(updatedTx);
  } catch (err) {
    console.error("Update Transaction Error:", err);
    res.status(500).json({ message: "Failed to update transaction" });
  }
});

module.exports = router;
