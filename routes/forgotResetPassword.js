const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { sendOtpEmail } = require("../utils/sendOtp");

// ✅ Step 1: Forgot Password — generate and send OTP (hashed)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before saving (improves security)
    const hashedOtp = await bcrypt.hash(otp, 10);
    user.resetOtp = hashedOtp;

    // 🔴 WAS: user.otpExpiry
    // ✅ USE SCHEMA FIELD NAME: otpExpires (and store as Date)
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Use new email system with "reset" template
    await sendOtpEmail({
      to: email,
      name: user.name,
      otp,
      type: "reset",
    });

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("❌ Error in forgotPassword:", err);
    res.status(500).json({ message: "Error generating OTP." });
  }
};

// ✅ Step 2: Reset Password — verify OTP (hashed) and update password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields are required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    // 🔴 WAS: user.otpExpiry
    // ✅ USE: user.otpExpires and compare as Date
    if (!user.otpExpires || user.otpExpires.getTime() < Date.now()) {
      return res
        .status(400)
        .json({ message: "OTP expired. Please request a new one." });
    }

    // Verify hashed OTP
    if (!user.resetOtp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    const isValidOtp = await bcrypt.compare(otp, user.resetOtp);
    if (!isValidOtp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear OTP fields
    user.resetOtp = undefined;
    user.otpExpires = undefined; // clear same field
    await user.save();

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error("❌ Error in resetPassword:", err);
    res.status(500).json({ message: "Error resetting password." });
  }
};

// ✅ Step 3: Resend OTP (hashed again + reset template)
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(newOtp, 10);

    user.resetOtp = hashedOtp;

    // 🔴 WAS: user.otpExpiry
    // ✅ USE: otpExpires
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail({
      to: email,
      name: user.name,
      otp: newOtp,
      type: "reset",
    });

    res.json({ message: "New OTP sent to your email." });
  } catch (err) {
    console.error("❌ Error in resendOtp:", err);
    res.status(500).json({ message: "Error resending OTP." });
  }
};
