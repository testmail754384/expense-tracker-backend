// models/EmailLog.js
const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    type: { type: String, enum: ["signup", "reset"], required: true },
    success: { type: Boolean, default: false },
    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailLog", emailLogSchema);
