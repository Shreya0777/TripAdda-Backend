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
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isPasswordvalid = await user.validatePassword(password);

    if (!isPasswordvalid) {
      throw new Error("Invalid credentials");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.loginOtp = otp;
    user.loginOtpExpires = Date.now() + 5 * 60 * 1000;

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Your TripAdda Login OTP",
      text: `Your TripAdda login OTP is ${otp}. It is valid for 5 minutes.`,
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      email: user.email,
    });
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
  }
});
authRouter.post("/verify-login-otp", async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({
    email,
    loginOtp: otp,
    loginOtpExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      message: "Invalid OTP",
    });
  }

  user.loginOtp = undefined;
  user.loginOtpExpires = undefined;

  await user.save();

  const token = await user.getJWT();

  res.cookie("token", token, cookieOptions);

  res.status(200).json({
    success: true,
    message: "Login successful",
    user,
  });
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
