const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
require('events').EventEmitter.defaultMaxListeners = 20; // increase to 20



dotenv.config();

const allowedOrigins = [
  "http://localhost:5173",
  "https://expense-tracker-frontend-8kdp.vercel.app"
];

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // limit each IP
  message: "Too many requests, please try again later.",
});

const authRoutes = require('./routes/auth');
const transactionRoutes = require("./routes/transactions");
const userUpdate = require("./routes/user")

const app = express();

app.use(express.json({ limit: "5mb" }));

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

if (process.env.NODE_ENV !== "production") {
  console.log("Allowed origins:", allowedOrigins);
}


app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", process.env.FRONTEND_URL],
      connectSrc: ["'self'", process.env.FRONTEND_URL],
      styleSrc: ["'self'", "'unsafe-inline'", process.env.FRONTEND_URL],
      imgSrc: ["'self'", "data:"],
    },
  }),
  helmet.referrerPolicy({ policy: 'no-referrer' }),
  helmet.crossOriginEmbedderPolicy()

);
app.use(mongoSanitize());
app.use(limiter); // use the limiter you defined

// Secure session cookies for production
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: process.env.NODE_ENV === "production", // only over HTTPS
    sameSite: 'lax', // prevents CSRF
    httpOnly: true,   // prevents client JS access
  }
}));

app.disable('x-powered-by');




app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/user",userUpdate)


mongoose.set('strictQuery', true);


// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

  // Global Error Handler (optional)
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ message: "Internal server error" });
});


// Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));