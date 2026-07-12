const express = require("express");
const { validateSignup } = require("../utils/validator");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
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

//to continue with google option
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        let user = await User.findOne({ email });

        if (!user) {
          user = new User({
            googleId: profile.id,
            name: profile.displayName,
            username: email.split("@")[0],
            email,
            photoURL: profile.photos?.[0]?.value,
            About: "Hey there! I'm using HelloTrips",
          });

          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

authRouter.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

authRouter.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "https://trip-adda-frontend.vercel.app/login",
  }),
  async (req, res) => {
    const token = await req.user.getJWT();

    res.cookie("token", token, cookieOptions);

    res.redirect("https://trip-adda-frontend.vercel.app/auth/success");
  },
);

authRouter.get("/check-username/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const existingUser = await User.findOne({ username });

    res.status(200).json({
      available: !existingUser,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

authRouter.post("/signup", async (req, res) => {
  try {
    validateSignup(req);

    const { name, username, email, password, age, photoURL, About } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    const existingEmail = await User.findOne({ email: normalizedEmail });

    if (existingEmail) {
      return res.status(400).json({
        message: "User already exists. Please login.",
      });
    }

    const existingUsername = await User.findOne({
      username: normalizedUsername,
    });

    if (existingUsername) {
      return res.status(400).json({
        message: "Username already exists",
      });
    }

    const passwordhash = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      password: passwordhash,
      age,
      photoURL,
      About,
    });

    await user.save();

    const token = await user.getJWT();

    res.cookie("token", token, cookieOptions);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user,
      token,
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];

      return res.status(400).json({
        message:
          field === "email"
            ? "User already exists. Please login."
            : "Username already exists",
      });
    }

    res.status(400).json({
      message: err.message || "Signup failed",
    });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    console.log("Login started");

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await user.validatePassword(password);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    console.log("Password verified");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.loginOtp = otp;
    user.loginOtpExpires = Date.now() + 5 * 60 * 1000;

    await user.save();
    await sendEmail({
      to: user.email,
      subject: "TripAdda Login Verification Code",
      text: `Hi,

Your TripAdda verification code is:

${otp}

This OTP is valid for 5 minutes.

If you didn't request this login, you can safely ignore this email.

- Team TripAdda`,
    });

    console.log("Email sent");

    console.log("OTP generated:", otp);

    return res.status(200).json({
      success: true,
      message: "OTP generated successfully",
      email: user.email,
      
    });
  } catch (err) {
    console.error("Login error:", err);

    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: err.message,
    });
  }
});
authRouter.post("/verify-login-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      loginOtp: otp.toString().trim(),
      loginOtpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;

    await user.save();

    const token = await user.getJWT();

    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user,
    });
  } catch (err) {
    console.error("OTP verify error:", err);

    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
      error: err.message,
    });
  }
});
authRouter.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetOtp: otp,
      resetOtpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    return res.json({
      success: true,
      message: "OTP verified",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
authRouter.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + 5 * 60 * 1000;

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Reset Password OTP",
      text: `
Hi,

Your TripAdda password reset OTP is

${otp}

This OTP will expire in 5 minutes.

If you didn't request this, simply ignore this email.

- Team TripAdda
`,
    });

    res.json({
      success: true,
      message: "OTP Sent",
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});
authRouter.post("/resend-login-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.loginOtp = otp;
    user.loginOtpExpires = Date.now() + 5 * 60 * 1000;

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "TripAdda Login Verification Code",
      text: `Your OTP is ${otp}`,
    });

    res.json({
      success: true,
      message: "OTP Sent",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

authRouter.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    const user = await User.findOne({
      email,
      resetOtp: otp,
      resetOtpExpires: {
        $gt: Date.now(),
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    user.password = hash;

    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;

    await user.save();

    res.json({
      success: true,
      message: "Password Updated",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });

  res.clearCookie("connect.sid", {
    secure: true,
    sameSite: "none",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Logout successfully",
  });
});

authRouter.get("/users/profile/view", authMiddleware, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");

    const user = req.user;

    if (!user) {
      throw new Error("User not found");
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
  }
});
authRouter.get("/users/profile/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name username photoURL About createdAt",
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
  }
});

module.exports = authRouter;
