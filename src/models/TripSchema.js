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
   from: {
  type: String,
  required: true,
  minlength: 2,
  maxlength: 50,
  match: /^[a-zA-Z\s]+$/
},

destination: {
  type: String,
  required: true,
  minlength: 2,
  maxlength: 50,
  match: /^[a-zA-Z\s]+$/
},
    duration: {
      type: String,
      required: true,
    },
    totalBudget: {
      type: Number,
      required: true,
    },
    transportation: {
      type: String,
      enum: ["Train", "flight", "bus", "other"],
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    hotelRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    media: [
      {
        url: String,
        type: {
          type: String,
          enum: ["image", "video"],
        },
      },
    ],
    pros: {
      type: String,
    },
    cons: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Trip", TripSchema);
