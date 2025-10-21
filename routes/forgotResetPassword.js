const User = require("../models/User");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer")




const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
});


// ✅ Step 1: Forgot Password — generate OTP
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 mins expiry
    await user.save();

    // send email logic here (e.g., using nodemailer)
    // console.log(`OTP for ${email}: ${otp}`);

    await transporter.sendMail({
      from: `"Your App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'OTP Sent To You',
      html: `<h2>Your OTP for reset password is: <b>${otp}</b></h2><p>It will expire in 10 minutes.</p>`,
    });

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    res.status(500).json({ message: "Error generating OTP." });
  }
};



// ✅ Step 2: Reset Password — verify OTP and update password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    // Verify OTP
    if (!user.resetOtp || user.resetOtp !== otp)
      return res.status(400).json({ message: "Invalid OTP." });

    // Check expiry
    if (user.otpExpiry < Date.now())
      return res.status(400).json({ message: "OTP expired. Please request a new one." });

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear OTP fields
    user.resetOtp = undefined;
    user.otpExpiry = undefined;

    await user.save();

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resetting password." });
  }
};

// ✅ Step 3: Resend OTP
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = newOtp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 mins expiry
    await user.save();

    // send email logic (reuse nodemailer if added)
    console.log(`New OTP for ${email}: ${newOtp}`);

    res.json({ message: "New OTP sent to your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resending OTP." });
  }
};

