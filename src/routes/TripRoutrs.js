const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/user");
const Trip = require("../models/TripSchema");
const AuthMiddleware = require("../middleware/authMiddleware");
const validator = require("validator");
const upload = require("../middleware/upload");

const TripRoutes = express.Router();

TripRoutes.post(
  "/trips",
  AuthMiddleware,
  upload.array("media", 10),
  async (req, res) => {
    try {
      const {
        title,
        description,

        // Destination
        city,
        state,
        country,

        // Boarding
        boardingPoint,

        // Trip
        duration,
        tripType,
        bestTimeToVisit,

        // Transport
        transportMode,
        transportName,
        transportRoute,
        transportDuration,
        transportFare,
        transportTips,

        // Budget
        totalBudget,
        costPerPerson,
        stayCost,
        foodCost,
        transportCost,
        sightseeingCost,
        otherCost,

        // Stay
        hotelName,
        stayLocation,
        pricePerNight,
        stayType,
        stayRating,
        stayReview,
        worthIt,

        // Food
        mustTryFoods,
        cafes,
        budgetFoodOptions,

        // Hidden Spots
        hiddenSpots,

        // Itinerary
        itineraryType,
        itineraryVideoUrl,
        itineraryDays,

        // Tips
        travelerTips,

        // Ratings
        overallRating,
        budgetRating,
        safetyRating,
        foodRating,
        stayRatingValue,
        transportRating,
        experienceRating,

        // Tags
        tags,
      } = req.body;

      const userId = req.user.id;

      // Upload media
      const uploadedMedia =
        req.files?.map((file) => ({
          url: file.path,
          type: file.mimetype.startsWith("video")
            ? "video"
            : "image",
        })) || [];

      // Required validations
      if (
        !title ||
        !description ||
        !city ||
        !boardingPoint ||
        !duration ||
        !totalBudget ||
        !costPerPerson ||
        !overallRating
      ) {
        return res.status(400).json({
          message: "Missing required fields",
        });
      }

      // Transport validation
      const validTransports = [
        "train",
        "flight",
        "bus",
        "car",
        "bike",
        "other",
      ];

      if (
        transportMode &&
        !validTransports.includes(transportMode)
      ) {
        return res.status(400).json({
          message: `Invalid transport mode`,
        });
      }

      // Create trip object
      const tripData = {
        userId,

        title: title.trim(),

        description: description.trim(),

        destination: {
          city,
          state,
          country: country || "India",
        },

        boardingPoint,

        duration,

        tripType: tripType || "friends",

        bestTimeToVisit,

        transportInfo: {
          mode: transportMode,
          transportName,
          route: transportRoute,
          duration: transportDuration,
          fare: transportFare,
          tips: transportTips
            ? JSON.parse(transportTips)
            : [],
        },

        budgetDetails: {
          totalBudget,
          costPerPerson,
          stayCost: stayCost || 0,
          foodCost: foodCost || 0,
          transportCost: transportCost || 0,
          sightseeingCost: sightseeingCost || 0,
          otherCost: otherCost || 0,
        },

        stayDetails: {
          hotelName,
          location: stayLocation,
          pricePerNight,
          stayType,
          rating: stayRating,
          stayReview,
          worthIt,
        },

        foodRecommendations: {
          mustTryFoods: mustTryFoods
            ? JSON.parse(mustTryFoods)
            : [],

          cafes: cafes
            ? JSON.parse(cafes)
            : [],

          budgetFoodOptions: budgetFoodOptions
            ? JSON.parse(budgetFoodOptions)
            : [],
        },

        hiddenSpots: hiddenSpots
          ? JSON.parse(hiddenSpots)
          : [],

        itinerary: {
          itineraryType: itineraryType || "text",

          videoUrl: itineraryVideoUrl,

          days: itineraryDays
            ? JSON.parse(itineraryDays)
            : [],
        },

        travelerTips: travelerTips
          ? JSON.parse(travelerTips)
          : [],

        ratings: {
          overall: overallRating,
          budget: budgetRating,
          safety: safetyRating,
          food: foodRating,
          stay: stayRatingValue,
          transport: transportRating,
          experience: experienceRating,
        },

        tags: tags ? JSON.parse(tags) : [],

        media: uploadedMedia,
      };

      // Joi / custom validator
      const { error: validationError } =
        validator.tripCreate
          ? validator.tripCreate(tripData)
          : { error: null };

      if (validationError) {
        return res.status(400).json({
          message: "Validation failed",
          errors:
            validationError.details || validationError,
        });
      }

      // Create trip
      const trip = await Trip.create(tripData);

      return res.status(201).json({
        message: "Trip created successfully",
        trip,
      });
    } catch (err) {
      console.error("Trip creation error:", err);

      if (err.name === "ValidationError") {
        return res.status(400).json({
          message: "Invalid data provided",
          errors: err.errors,
        });
      }

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);

TripRoutes.get("/trips/my-trips", AuthMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const trips = await Trip.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json(trips);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch your trips",
    });
  }
});

TripRoutes.get("/trips/feed", AuthMiddleware, async (req, res) => {
  try {
    // Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    let limit = parseInt(req.query.limit) || 6;

    limit = limit > 25 ? 25 : limit;

    const skip = (page - 1) * limit;

    // Query params
    const {
      destination,
      minBudget,
      maxBudget,
      transportMode,
      minRating,
      tripType,
      sortBy,
      tag,
    } = req.query;

    // Filters
    let filter = {};

    // Destination filter
    if (destination) {
      filter["destination.city"] = {
        $regex: destination,
        $options: "i",
      };
    }

    // Budget filter
    if (minBudget || maxBudget) {
      filter["budgetDetails.costPerPerson"] = {};

      if (minBudget) {
        filter["budgetDetails.costPerPerson"].$gte =
          Number(minBudget);
      }

      if (maxBudget) {
        filter["budgetDetails.costPerPerson"].$lte =
          Number(maxBudget);
      }
    }

    // Transport filter
    if (transportMode) {
      filter["transportInfo.mode"] = transportMode;
    }

    // Rating filter
    if (minRating) {
      filter["ratings.overall"] = {
        $gte: Number(minRating),
      };
    }

    // Trip type
    if (tripType) {
      filter.tripType = tripType;
    }

    // Tags filter
    if (tag) {
      filter.tags = {
        $in: [tag.toLowerCase()],
      };
    }

    // Sorting
    let sortOption = {
      createdAt: -1,
    };

    if (sortBy === "budget_low") {
      sortOption = {
        "budgetDetails.costPerPerson": 1,
      };
    }

    if (sortBy === "budget_high") {
      sortOption = {
        "budgetDetails.costPerPerson": -1,
      };
    }

    if (sortBy === "rating_high") {
      sortOption = {
        "ratings.overall": -1,
      };
    }

    // Fetch trips
    const Trips = await Trip.find(filter)
      .populate("userId", "name profilePhoto")
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    // Total count
    const totalTrips = await Trip.countDocuments(filter);

    // Response
    res.status(200).json({
      success: true,

      page,

      totalPages: Math.ceil(totalTrips / limit),

      totalTrips,

      Trips,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
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
TripRoutes.put("/trips/update/:id", AuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid trip ID" });
    }
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ message: "Trip Not found" });
    }
    if (trip.userId.toString() !== req.user.id) {
      return res.status(403).json({
        message: "You are not authorized to update this trip",
      });
    }
    const updatedTrip = await Trip.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.status(200).json({
      message: "Trip updated successfully",
      updatedTrip,
    });
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
  }
});
TripRoutes.delete("/trips/delete/:id", AuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid trip Id" });
    }
    const trip = await Trip.findById(id);

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }
    if (trip.userId.toString() !== req.user.id) {
      return res.status(403).json({
        message: "You are not authorized to delete this trip",
      });
    }
    await Trip.findByIdAndDelete(id);
    res.status(200).json({
      message: " Trip deleted successfully",
    });
  } catch (err) {
    res.status(400).send("ERROR:" + err.message);
  }
});

module.exports = { TripRoutes };
