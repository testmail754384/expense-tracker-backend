const express = require("express");
const router = express.Router();
const mongoose = require('mongoose')
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const Transaction = require("../models/Transaction");
const ExcelJS = require("exceljs");


// --- Get current user ---
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// --- Update profile (name + optional profilePic) ---
router.put("/update-profile", authMiddleware , async (req, res) => {
  const { name, profilePic } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ message: "Name is required" });

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = name.trim();
    if (profilePic) user.profilePic = profilePic; // optional

    await user.save();
    res.json({ message: "Profile updated", user: { name: user.name, email: user.email, profilePic: user.profilePic } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- Change password ---
router.put("/change-password", authMiddleware , async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ message: "Both passwords are required" });
  if (newPassword.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });

  try {
    const user = await User.findById(req.userId);
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Old password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- Export transactions as CSV ---
router.get("/export", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const transactions = await Transaction.find({ userId }).sort({ date: -1 });

    if (!transactions.length) {
      return res.status(404).json({ message: "No transactions found" });
    }

    // Build CSV string with Type column
    let csv = "Date,Type,Amount,Category,Description\n";
    transactions.forEach((tx) => {
      const dateStr = tx.date ? tx.date.toISOString() : "";
      const type = tx.type ?? ""; // income or expense
      const amount = tx.amount ?? "";
      const category = tx.category ?? "";
      const description = tx.description?.replace(/,/g, " ") ?? "";
      csv += `${dateStr},${type},${amount},${category},${description}\n`;
    });

    res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");
    res.setHeader("Content-Type", "text/csv");
    return res.send(csv);
  } catch (err) {
    console.error("Export CSV error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Failed to export CSV." });
    }
  }
});

// Export transactions as xls format

router.get("/export-excel", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.userId });

    if (!transactions.length) {
      return res.status(404).json({ message: "No transactions found" });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transactions");

    // Define columns
    worksheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Type", key: "type", width: 10 },
      { header: "Category", key: "category", width: 15 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Description", key: "description", width: 25 },
    ];

    // Add rows
    transactions.forEach(tx => {
      worksheet.addRow({
        date: tx.date.toISOString().split("T")[0],
        type: tx.type,
        category: tx.category,
        amount: tx.amount,
        description: tx.description || "",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Expense_Report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Excel export failed" });
  }
});



// --- Delete all transactions for logged-in user ---
router.delete("/delete-all-transactions", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId ;
    console.log("User ID:", req.userId);


    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const result = await Transaction.deleteMany({ userId: userId });

    return res.json({ message: `Deleted ${result.deletedCount} transactions.`, result: `${result}` });

  } catch (err) {
    console.error("Delete transactions error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Failed to delete transactions." });
    }
  }
});




module.exports = router;
