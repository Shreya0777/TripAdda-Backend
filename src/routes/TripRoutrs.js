const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/user");
const Trip = require("../models/TripSchema");
const AuthMiddleware = require("../middleware/authMiddleware");

const TripRoutes = express.Router();

TripRoutes.post("/trips", AuthMiddleware, async (req, res) => {
  try {
    const {
      from,
      destination,
      duration,
      totalBudget,
      transportation,
      description,
      hotelRating,
      overallRating,
      media,
      pros,
      cons,
    } = req.body;

    // Basic validation
    if (!from || !destination || !totalBudget || !transportation) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }
    if (from.toLowerCase() === destination.toLowerCase()) {
      return res.status(400).json({
        message: "From and Destination cannot be same",
      });
    }

    const trip = await Trip.create({
      userId: req.user.id,
      from,
      destination,
      duration,
      totalBudget,
      transportation,
      description,
      hotelRating,
      overallRating,
      media,
      pros,
      cons,
    });

    res.status(201).json({
      message: "Trip Created Successfully",
      trip,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

TripRoutes.get("/trips/feed", AuthMiddleware, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    let limit = parseInt(req.query.limit) || 3;
    limit = limit > 25 ? 25 : limit;
    const skip = (page - 1) * limit;

    const Trips = await Trip.find()
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalTrips = await Trip.countDocuments();

    res.status(200).json({
      page,
      totalPages: Math.ceil(totalTrips / limit),
      totalTrips,
      Trips,
    });
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
  }
});
TripRoutes.get("/trips/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid trip ID",
      });
    }
    const trip = await Trip.findById(id).populate("userId", "name email");

    if (!trip) {
      return res.status(404).json({
        message: "Trip not found",
      });
    }
    res.status(200).json(trip);
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
  }
});

module.exports = { TripRoutes };
