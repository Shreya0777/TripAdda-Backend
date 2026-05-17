const express = require("express");
const { validateSignup } = require("../utils/validator");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const authMiddleware = require("../middleware/authMiddleware");

const authRouter = express.Router();

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
    }
  )
);

authRouter.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

authRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "https://trip-adda-frontend.vercel.app/login",
  }),
  async (req, res) => {
    const token = await req.user.getJWT();

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect("https://trip-adda-frontend.vercel.app/auth/success");
    
  }
);

authRouter.post("/signup", async (req, res) => {
  try {
    validateSignup(req);

    const { name, username, email, password, age, photoURL, About } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const passwordhash = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      username,
      email,
      password: passwordhash,
      age,
      photoURL,
      About,
    });

    await user.save();

    const token = await user.getJWT();

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.send("user created successfully");
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
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

    const token = await user.getJWT();

    res.cookie("token", token, {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

    res.status(200).json({
  message: "Login successful",
  token,
  user,
});
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
  }
});

authRouter.post("/logout", (req, res) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
  });

  res.send("Logout successfully");
});

authRouter.get("/users/profile/view", authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      throw new Error("User not found");
    }

    res.send(user);
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
  }
});

module.exports = authRouter;