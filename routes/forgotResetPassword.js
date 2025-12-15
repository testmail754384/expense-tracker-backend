const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { sendOtpEmail } = require("../utils/sendOtp");
const rateLimit = require("express-rate-limit");

/* ---------- RATE LIMITER ---------- */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many OTP requests. Try again later." },
});

/* =================================================
   STEP 1: FORGOT PASSWORD
================================================= */
exports.forgotPassword = [
  
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email)
        return res.status(400).json({ message: "Email is required." });

      const user = await User.findOne({ email });
      if (!user)
        return res.status(404).json({ message: "User not found." });

      // ❌ Google users cannot reset password
      if (!user.password) {
        return res.status(400).json({
          message: "This account uses Google login. Password reset not allowed.",
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.resetOtp = await bcrypt.hash(otp, 10);
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      await user.save();

      await sendOtpEmail({
        to: email,
        name: user.name,
        otp,
        type: "reset",
      });

      res.json({
        success: true,
        message: "OTP sent to your email.",
        expiresIn: "10 minutes",
      });
    } catch (err) {
      console.error("❌ Forgot Password Error:", err);
      res.status(500).json({ message: "Failed to send OTP." });
    }
  },
];

/* =================================================
   STEP 2: RESET PASSWORD
================================================= */
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields are required." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found." });

    if (!user.otpExpires || user.otpExpires < Date.now()) {
      return res
        .status(400)
        .json({ message: "OTP expired. Please request a new one." });
    }

    if (!user.resetOtp)
      return res.status(400).json({ message: "Invalid OTP." });

    const isValid = await bcrypt.compare(otp, user.resetOtp);
    if (!isValid)
      return res.status(400).json({ message: "Invalid OTP." });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = undefined;
    user.otpExpires = undefined;

    await user.save();

    console.log(`🔐 Password reset successful for ${email}`);

    res.json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (err) {
    console.error("❌ Reset Password Error:", err);
    res.status(500).json({ message: "Password reset failed." });
  }
};

/* =================================================
   STEP 3: RESEND OTP
================================================= */
exports.resendOtp = [
  
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email)
        return res.status(400).json({ message: "Email is required." });

      const user = await User.findOne({ email });
      if (!user)
        return res.status(404).json({ message: "User not found." });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.resetOtp = await bcrypt.hash(otp, 10);
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      await user.save();

      await sendOtpEmail({
        to: email,
        name: user.name,
        otp,
        type: "reset",
      });

      res.json({
        success: true,
        message: "New OTP sent to your email.",
      });
    } catch (err) {
      console.error("❌ Resend OTP Error:", err);
      res.status(500).json({ message: "Failed to resend OTP." });
    }
  },
];
