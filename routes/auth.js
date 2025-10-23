// This file consolidates all backend authentication logic.
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');





const router = express.Router();

// --- 1. Mongoose User Model ---
// Using the separate User model file
const User = require('../models/User');


const {forgotPassword, resetPassword, resendOtp}  = require('./forgotResetPassword.js') // imorted the functions to verify and resend otp

// @desc    Send OTP to reset password
// @route   POST /api/auth/forgot-password
router.post('/forgot-password',forgotPassword );
router.post("/reset-pass", resetPassword);
router.post("/resend-otp", resendOtp);



// --- 2. Passport.js Configuration ---
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email found in Google profile"));
        }

        let user = await User.findOne({ email });

        if (!user) {
          // If no user exists, create a new one with Google ID
          user = new User({
            name: profile.displayName,
            email,
            googleId: profile.id,
          });
          await user.save();
        } else if (!user.googleId) {
          // If user exists but Google ID isn't linked, link it
          user.googleId = profile.id;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// --- 3. Nodemailer Configuration ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // This MUST be a Google App Password
  },
});

// --- 4. Controller Logic & API Routes ---







// @desc    Reset password using OTP
// @route   POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const user = await User.findOne({
      email,
      otp,
      otpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Error in /reset-password:', err);
    res.status(500).json({ message: 'Server error. Could not reset password.' });
  }
});




// @desc    Check user and send OTP for signup
// @route   POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.password) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
    }
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

    let userToUpdate;
    if (existingUser) {
      // User exists from Google Sign-in, update their OTP
      existingUser.otp = otp;
      existingUser.otpExpires = otpExpires;
      userToUpdate = existingUser;
    } else {
      // No user exists, create a temporary record for OTP verification
      userToUpdate = await User.create({
          email,
          otp,
          otpExpires,
          name: "Temporary User" // Placeholder name
      });
    }
    await userToUpdate.save();


    // Send email
    await transporter.sendMail({
      from: `"Your App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      html: `<h2>Your OTP for signup is: <b>${otp}</b></h2><p>It will expire in 10 minutes.</p>`,
    });

    res.status(200).json({ message: 'OTP sent to your email successfully.' });

  } catch (err) {
    console.error("Error in /send-otp:", err);
    res.status(500).json({ message: 'Server error. Could not send OTP.' });
  }
});


// @desc    User signup with email, password, and OTP
// @route   POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password, otp } = req.body;
  if (!name || !email || !password || !otp) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const user = await User.findOne({
      email,
      otp,
      otpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP. Please try again.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Update the user's details now that they are verified
    user.name = name;
    user.password = hashedPassword;
    user.otp = undefined; // Clear OTP fields
    user.otpExpires = undefined;
    await user.save();

    // Automatically log the user in by creating a token
    const token = jwt.sign({ id: user._id, email: user.email, name:user.name }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.status(201).json({ message: 'Signup successful!', token });
  } catch (err) {
    console.error("Error in /signup:", err);
    res.status(500).json({ message: 'Server error during signup.' });
  }
});


// @desc    User login with email and password
// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please sign up.' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'You signed up with Google. Please use Google to log in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user._id, email: user.email , name:user.name}, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(200).json({ token });
  } catch (err) {
    console.error("Error in /login:", err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});


// @desc    Initiate Google OAuth flow
// @route   GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email']}));


// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login?error=true` }),
  (req, res) => {
    // On successful authentication, req.user is available.
    const token = jwt.sign({ id: req.user._id, email: req.user.email, name:req.user.name }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });
    
    // Redirect to frontend with the token
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
    console.log(res)
  }
);




module.exports = router;

