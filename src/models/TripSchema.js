const mongoose = require("mongoose");
const express = require("express");
const { validator } = require("../utils/validator");

const TripSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 📍 Locations
    from: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    // 📅 Trip Info
    duration: {
      type: Number, // better than string
      required: true,
      min: 1,
    },

    tripType: {
      type: String,
      enum: ["solo", "friends", "family", "couple"],
      default: "friends",
    },

    bestTimeToVisit: {
      type: String,
    },

    // 💰 Budget
    totalBudget: {
      type: Number,
      required: true,
      min: 0,
    },

    costPerPerson: {
      type: Number,
    },

    // 🚗 Transport
    transportation: {
      type: String,
      enum: ["train", "flight", "bus", "car", "other"],
      required: true,
    },

    localTravel: {
      type: String, // cab, bike, auto etc.
    },

    // 🏨 Stay
    hotelName: {
      type: String,
    },

    hotelRating: {
      type: Number,
      min: 1,
      max: 5,
    },

    stayCost: {
      type: Number,
    },

    // 📝 Experience
    description: {
      type: String,
      maxlength: 1000,
    },

    tips: {
      type: String,
      maxlength: 500,
    },

    pros: {
      type: String,
    },

    cons: {
      type: String,
    },

    // ⭐ Ratings
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    // 🏷 Tags
    tags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],

    // 🖼 Media
    media: [
      {
        url: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["image", "video"],
          default: "image",
        },
      },
    ],

    // 🔥 Future features (already ready)
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    saves: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trip", TripSchema);