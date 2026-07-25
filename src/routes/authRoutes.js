const express = require("express");
const rateLimit = require("express-rate-limit");
const { validateSignup } = require("../utils/validator");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const passport = require("passport");
// FIX: the Google strategy is registered once, in config/Passport.js
// (make sure server.js does `require("./config/Passport")` before this
// router is mounted). It was previously defined a second time here with
// slightly different fallback logic (different default `About` text,
// no googleId backfill on existing accounts) — a classic "which copy is
// actually running" bug.
const authMiddleware = require("../middleware/authMiddleware");
const sendEmail = require("../utils/sendEmail");

const authRouter = express.Router();

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://trip-adda-frontend.vercel.app";

// FIX: OTP endpoints are brute-forceable 6-digit codes — give them a much
// tighter, dedicated limiter instead of relying only on the global
// 100-req/15min limit in server.js.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many attempts, please try again later." },
});

// FIX: single helper instead of the same 4 lines duplicated 3x across
// login / forgot-password / resend-otp.
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const OTP_TTL_MS = 5 * 60 * 1000;

authRouter.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false }),
);

authRouter.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    // FIX: this pointed to `${FRONTEND_URL}/login` — but this app has no
    // /login route at all (auth happens in a modal, not a page), so any
    // Google auth failure landed on a real "Page Not Found." Redirecting
    // to the root with a query flag at least lands somewhere real; the
    // frontend can optionally read `authError` to show a toast/open the
    // login modal automatically.
    failureRedirect: `${FRONTEND_URL}/?authError=google`,
  }),
  async (req, res) => {
    const token = req.user.getJWT();
    res.cookie("token", token, cookieOptions);
    res.redirect(`${FRONTEND_URL}/auth/success`);
  },
);

authRouter.get("/check-username/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();
    const existingUser = await User.findOne({ username }).select("_id");
    res.status(200).json({ available: !existingUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

authRouter.post("/signup", async (req, res) => {
  try {
    validateSignup(req);

    const { name, username, email, password, age, photoURL, About } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    // FIX: two round trips replaced with one query checking both fields;
    // still tells the client which one collided.
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    }).select("email username");

    if (existing) {
      const field = existing.email === normalizedEmail ? "email" : "username";
      return res.status(400).json({
        message:
          field === "email"
            ? "User already exists. Please login."
            : "Username already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      password: passwordHash,
      age,
      photoURL,
      About,
    });

    const token = user.getJWT();
    res.cookie("token", token, cookieOptions);

    // FIX: user.toJSON() (defined on the schema) now strips password/OTP
    // fields automatically — no hash goes over the wire.
    res.status(201).json({
      success: true,
      message: "User created successfully",
      user,
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      return res.status(400).json({
        message:
          field === "email" ? "User already exists. Please login." : "Username already exists",
      });
    }
    res.status(400).json({ message: err.message || "Signup failed" });
  }
});

authRouter.post("/login", otpLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // FIX: password now has `select: false` on the schema, so it must be
    // explicitly requested here — this also makes it obvious, at the call
    // site, exactly which routes touch the password hash.
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    if (!user || !user.password) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    const otp = generateOtp();
    user.loginOtp = otp;
    user.loginOtpExpires = Date.now() + OTP_TTL_MS;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "TripAdda Login Verification Code",
      text: `Hi,\n\nYour TripAdda verification code is:\n\n${otp}\n\nThis OTP is valid for 5 minutes.\n\nIf you didn't request this login, you can safely ignore this email.\n\n- Team TripAdda`,
    });

    return res.status(200).json({
      success: true,
      message: "OTP generated successfully",
      email: user.email,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
});

authRouter.post("/verify-login-otp", otpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      loginOtp: otp.toString().trim(),
      loginOtpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;
    await user.save();

    const token = user.getJWT();
    res.cookie("token", token, cookieOptions);

    return res.status(200).json({ success: true, message: "Login successful", user });
  } catch (err) {
    console.error("OTP verify error:", err.message);
    return res.status(500).json({ success: false, message: "OTP verification failed" });
  }
});

authRouter.post("/verify-reset-otp", otpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({
      email: (email || "").toLowerCase().trim(),
      resetOtp: otp,
      resetOtpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    return res.json({ success: true, message: "OTP verified" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

authRouter.post("/forgot-password", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = generateOtp();
    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + OTP_TTL_MS;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Reset Password OTP",
      text: `Hi,\n\nYour TripAdda password reset OTP is\n\n${otp}\n\nThis OTP will expire in 5 minutes.\n\nIf you didn't request this, simply ignore this email.\n\n- Team TripAdda`,
    });

    res.json({ success: true, message: "OTP Sent", email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

authRouter.post("/resend-login-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = generateOtp();
    user.loginOtp = otp;
    user.loginOtpExpires = Date.now() + OTP_TTL_MS;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "TripAdda Login Verification Code",
      text: `Your OTP is ${otp}`,
    });

    res.json({ success: true, message: "OTP Sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

authRouter.post("/reset-password", otpLimiter, async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    // FIX: email wasn't normalized here (unlike every other route),
    // so a reset would silently fail for "User@Example.com".
    const user = await User.findOne({
      email: (email || "").toLowerCase().trim(),
      resetOtp: otp,
      resetOtpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.json({ success: true, message: "Password Updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "none", path: "/" });
  return res.status(200).json({ success: true, message: "Logout successfully" });
});

authRouter.get("/users/profile/view", authMiddleware, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(req.user);
});

authRouter.get("/users/profile/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name username photoURL About createdAt",
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = authRouter;