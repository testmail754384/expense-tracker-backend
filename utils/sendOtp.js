// utils/sendOtp.js
const nodemailer = require("nodemailer");
const EmailLog = require("../models/EmailLog"); // we'll create this model below

/**
 * Email transporter configuration
 */
const transporter = nodemailer.createTransport({
  service: "gmail", // or custom SMTP
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Returns OTP email HTML for different flows
 * type: "signup" | "reset"
 */
const getOtpEmailTemplate = ({ type, name, otp }) => {
  const safeName = name || "there";
  const baseStyles = `
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f3f4f6;
    padding: 24px;
  `;
  const cardStyles = `
    max-width: 480px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 12px;
    padding: 24px 20px;
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
    border: 1px solid #e5e7eb;
  `;
  const badgeStyles = `
    display:inline-block;
    padding:4px 10px;
    border-radius:999px;
    font-size:11px;
    letter-spacing:0.06em;
    text-transform:uppercase;
    margin-bottom:8px;
  `;

  if (type === "signup") {
    return `
      <div style="${baseStyles}">
        <div style="${cardStyles}">
          <div style="text-align:center;margin-bottom:16px;">
            <div style="${badgeStyles};background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;">
              Welcome to ExpensePro
            </div>
            <h1 style="font-size:22px;margin:8px 0 4px;color:#111827;">
              Verify your email, ${safeName} 👋
            </h1>
            <p style="font-size:14px;color:#4b5563;margin:0;">
              Use the one-time code below to complete your sign up.
            </p>
          </div>

          <div style="text-align:center;margin:24px 0;">
            <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">
              Your verification code
            </div>
            <div style="
              display:inline-block;
              font-size:28px;
              letter-spacing:0.42em;
              padding:10px 18px;
              border-radius:999px;
              background:#ecfdf3;
              color:#16a34a;
              border:1px solid #bbf7d0;
              font-weight:700;
            ">
              ${otp}
            </div>
            <p style="font-size:13px;color:#6b7280;margin-top:10px;">
              This code expires in <strong>10 minutes</strong>.
            </p>
          </div>

          <div style="font-size:13px;color:#6b7280;margin-top:8px;line-height:1.5;">
            <p style="margin:0 0 6px;">
              If you didn't try to create an ExpensePro account, you can safely ignore this email.
            </p>
            <p style="margin:0;">
              See you inside 👀<br/>
              <span style="color:#16a34a;font-weight:600;">ExpensePro Team</span>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  // default: reset password template
  return `
    <div style="${baseStyles}">
      <div style="${cardStyles}">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="${badgeStyles};background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">
            Password Reset
          </div>
          <h1 style="font-size:22px;margin:8px 0 4px;color:#111827;">
            Reset your password, ${safeName}
          </h1>
          <p style="font-size:14px;color:#4b5563;margin:0;">
            Use the following one-time code to reset your password.
          </p>
        </div>

        <div style="text-align:center;margin:24px 0;">
          <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">
            Your reset code
          </div>
          <div style="
            display:inline-block;
            font-size:28px;
            letter-spacing:0.42em;
            padding:10px 18px;
            border-radius:999px;
            background:#eff6ff;
            color:#1d4ed8;
            border:1px solid #bfdbfe;
            font-weight:700;
          ">
            ${otp}
          </div>
          <p style="font-size:13px;color:#6b7280;margin-top:10px;">
            This code will expire in <strong>10 minutes</strong>.
          </p>
        </div>

        <div style="font-size:13px;color:#6b7280;margin-top:8px;line-height:1.5;">
          <p style="margin:0 0 6px;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>
          <p style="margin:0;">
            Stay on top of your spending 💸<br/>
            <span style="color:#1d4ed8;font-weight:600;">ExpensePro Security</span>
          </p>
        </div>
      </div>
    </div>
  `;
};

/**
 * Sends an OTP email using Nodemailer + logs analytics
 * type: "signup" | "reset"
 */
const sendOtpEmail = async ({ to, name, otp, type }) => {
  const emailType = type === "signup" ? "signup" : "reset";

  const html = getOtpEmailTemplate({
    type: emailType,
    name,
    otp,
  });

  try {
    await transporter.sendMail({
      from: `"ExpensePro" <${process.env.EMAIL_USER}>`,
      to,
      subject:
        emailType === "signup"
          ? "Verify your email for ExpensePro"
          : "Your ExpensePro password reset code",
      html,
    });

    console.log(`📩 OTP email (${emailType}) sent to ${to}`);

    // basic analytics logging
    await EmailLog.create({
      to,
      type: emailType,
      success: true,
      error: null,
    });
  } catch (error) {
    console.error("❌ Error sending OTP email:", error);

    await EmailLog.create({
      to,
      type: emailType,
      success: false,
      error: error.message || "Unknown error",
    });

    throw new Error("Failed to send OTP email.");
  }
};

module.exports = {
  sendOtpEmail,
  getOtpEmailTemplate,
};
