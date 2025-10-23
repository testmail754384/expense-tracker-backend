const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Transaction = require("../models/Transaction");


// --- Middleware: Verify JWT ---
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains user ID and email
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// --- Get all transactions for this user ---
router.get("/", verifyToken, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

// --- Create a new transaction ---
router.post("/", verifyToken, async (req, res) => {
  try {
    const { type, category, amount, date, description, receipt} = req.body;
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
      userId: req.user.id, // Link transaction to user
    });
    await tx.save();
    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create transaction" });
  }
});

// --- Delete a transaction ---
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const tx = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!tx) return res.status(404).json({ message: "Transaction not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete transaction" });
  }
});

// --- Update a transaction ---
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const upDatedtx = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!upDatedtx) return res.status(404).json({ message: "Transaction not found" });
    res.json(upDatedtx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update transaction" });
  }
});

module.exports = router;
