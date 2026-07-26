const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minLength: 4,
      maxLength: 20,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      maxLength: 30,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      // FIX: Mongoose only recognizes `validate`, not `validator`.
      // The old key name silently disabled this check entirely.
      validate: {
        validator: (value) => validator.isEmail(value),
        message: "Invalid email format",
      },
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minLength: 8,
      // FIX: same bug — was `validator(value)`, never ran.
      // Also skip the check for Google accounts, which have no password.
      validate: {
        validator: function (value) {
          if (!value) return true;
          return validator.isStrongPassword(value);
        },
        message:
          "Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character",
      },
      // FIX: never send the hash back to the client by accident.
      select: false,
    },
    googleId: {
      type: String,
    },
    age: {
      type: Number,
    },
    gender: {
      type: String,
      enum: {
        values: ["Male", "Female", "Other", "male", "female", "other"],
        message: "Gender data is invalid",
      },
    },
    photoURL: {
      type: String,
      default:
        "https://tse2.mm.bing.net/th/id/OIP.9k6NZTQk5G6g5PVDDDeLiAHaHa?pid=Api&P=0&h=180",
      // FIX: same `validator` -> `validate` bug.
      validate: {
        validator: (value) => !value || validator.isURL(value),
        message: "Invalid URL format",
      },
    },
    loginOtp: { type: String, select: false },
    loginOtpExpires: { type: Date, select: false },
    resetOtp: { type: String, select: false },
    resetOtpExpires: { type: Date, select: false },
    About: {
      type: String,
      default: "Hey there! I'm using Trip_Trail",
      maxLength: 300,
    },
  },
  {
    timestamps: true,
  },
);

// Helpful for the "check-username" / lookups you already do by these fields.
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

userSchema.methods.getJWT = function () {
  const token = jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  return token;
};

userSchema.methods.validatePassword = async function (candidatePassword) {
  // `password` has `select: false` now, so callers must
  // `.select('+password')` when they need this (login route does).
  return bcrypt.compare(candidatePassword, this.password);
};

// FIX: make sure password/OTP fields never leak in res.json(user),
// even if a route forgets to strip them manually.
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginOtp;
  delete obj.loginOtpExpires;
  delete obj.resetOtp;
  delete obj.resetOtpExpires;
  return obj;
};

module.exports = mongoose.model("User", userSchema);