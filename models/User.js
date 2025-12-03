const mongoose = require('mongoose');

// --- USER MONGOOSE SCHEMA ---
// This defines the structure for the user documents in your MongoDB collection.
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, // Ensures no two users can have the same email
  },
  password: {
    type: String, // Not required for users signing up with Google OAuth
  },
  googleId: {
    type: String, // Stores the unique ID from the user's Google profile
  },
  otp: {
    type: String, // Stores the 6-digit one-time password for signup verification
  },
  resetOtp: { type: String },
  otpExpires: {
    type: Date, // Stores the timestamp when the OTP will expire
  },
  isVerified: { type: Boolean, default: false },
}, {
  // --- NEW: ADDED TIMESTAMPS ---
  // This option tells Mongoose to automatically add `createdAt` and `updatedAt`
  // fields to the schema.
  timestamps: true,
});

// Create and export the User model based on the schema
module.exports = mongoose.model('User', userSchema);

