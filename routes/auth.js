// This file consolidates all backend authentication logic.
const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const { sendOtpEmail, getOtpEmailTemplate } = require("../utils/sendOtp.js");
const User = require("../models/User.js");
const {
  forgotPassword,
  resetPassword,
  resendOtp,
} = require("./forgotResetPassword.js");

const router = express.Router();

/* ================================
   🌐 GOOGLE OAUTH STRATEGY SETUP
   ================================ */

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,       // from Google Cloud
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Try to find existing user by googleId
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // If there isn't one, try by email to avoid duplicates
          const email = profile.emails?.[0]?.value;
          if (email) {
            user = await User.findOne({ email });
          }

          if (!user) {
            // Create a new user
            user = await User.create({
              googleId: profile.id,
              name: profile.displayName || "User",
              email: email || "",
              isVerified: true,       // Google-verified email
            });
          } else {
            // If user existed with email but no googleId, link it
            if (!user.googleId) {
              user.googleId = profile.id;
              user.isVerified = true;
              await user.save();
            }
          }
        }

        return done(null, user);
      } catch (err) {
        console.error("GoogleStrategy error:", err);
        return done(err, null);
      }
    }
  )
);

// If you use sessions in future, add serializeUser / deserializeUser.
// For pure JWT-based auth, this is enough for now.

/* ================================
   🔁 FORGOT / RESET / RESEND OTP
   ================================ */

router.post("/forgot-password", forgotPassword);
router.post("/reset-pass", resetPassword);
router.post("/resend-otp", resendOtp);

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 OTP requests per 15 minutes per IP
  message: {
    success: false,
    message: "Too many OTP requests, try again later.",
  },
});

/* ================================
   📩 SEND OTP (Signup / Verification)
   @route POST /api/auth/send-otp
   ================================ */

router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    const hashedOtp = await bcrypt.hash(otp, 10);

    let user = await User.findOne({ email });

    if (user) {
      if (user.isVerified)
        return res
          .status(400)
          .json({
            success: false,
            message: "User already exists. Please log in.",
          });

      user.otp = hashedOtp;
      user.otpExpires = otpExpiry;
      await user.save();
    } else {
      if (!name)
        return res
          .status(400)
          .json({
            success: false,
            message: "Name is required for new users",
          });

      user = new User({
        name,
        email,
        otp: hashedOtp,
        otpExpires: otpExpiry,
        isVerified: false,
      });
      await user.save();
    }

    // send signup-type email
    await sendOtpEmail({ to: email, name, otp, type: "signup" });

    res.json({
      success: true,
      message: "OTP sent successfully! Expires in 10 minutes.",
    });
  } catch (err) {
    console.error("❌ Error sending OTP:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

/* ================================
   📝 SIGNUP WITH OTP
   @route POST /api/auth/signup
   ================================ */

router.post("/signup", async (req, res) => {
  const { name, email, password, otp } = req.body;
  if (!name || !email || !password || !otp) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const user = await User.findOne({
      email,
      otpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired OTP. Please try again." });
    }

    const isValidOtp = await bcrypt.compare(otp, user.otp);
    if (!isValidOtp) {
      return res
        .status(400)
        .json({ message: "Invalid or expired OTP. Please try again." });
    }


    if (user.isVerified) {
      return res
        .status(400)
        .json({
          message: "User already registered. Please log in.",
        });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    user.name = name;
    user.password = hashedPassword;
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({ message: "Signup successful!", token });
  } catch (err) {
    console.error("Error in /signup:", err);
    res.status(500).json({ message: "Server error during signup." });
  }
});

/* ================================
   🔑 LOGIN WITH EMAIL & PASSWORD
   @route POST /api/auth/login
   ================================ */

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found. Please sign up." });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "You signed up with Google. Please use Google to log in.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({ token });
  } catch (err) {
    console.error("Error in /login:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

/* ================================
   🌐 GOOGLE OAUTH ROUTES
   ================================ */

// @desc    Initiate Google OAuth flow
// @route   GET /api/auth/google
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=true`,
  }),
  (req, res) => {
    // On successful authentication, req.user is available.
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email, name: req.user.name },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    // Redirect to frontend with token
    res.redirect(
  `${process.env.FRONTEND_URL}/google-success?token=${token}`
);

  }
);

module.exports = router;
