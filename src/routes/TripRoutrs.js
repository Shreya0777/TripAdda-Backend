const express = require("express");
const mongoose = require("mongoose");
const Trip = require("../models/TripSchema");
const AuthMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const TripRoutes = express.Router();

const VALID_TRANSPORTS = ["train", "flight", "bus", "car", "bike", "other"];

// FIX: req.body.transportTips (and mustTryFoods, hiddenSpots, dayLogEntries,
// etc.) come in as JSON strings from multipart form-data. The old code did
// `JSON.parse(x)` directly — a single malformed field threw an uncaught
// SyntaxError caught only by the generic 500 handler, with no indication
// of which field was bad. This wraps it and reports the offending field.
const safeParseArray = (value, fieldName) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error(`Invalid JSON in "${fieldName}"`);
  }
};

// FIX: whitelist of fields a user is allowed to change on their own trip.
// The old PUT route did `Trip.findByIdAndUpdate(id, req.body)` — passing
// the raw client body straight to Mongo, which meant a request could
// silently overwrite `userId` (hijacking ownership of a trip), inject
// arbitrary top-level fields, or corrupt nested rating data. This list
// mirrors the schema's editable, user-facing fields only.
const TRIP_UPDATABLE_FIELDS = [
  "title",
  "description",
  "destination",
  "boardingPoint",
  "duration",
  "tripType",
  "bestTimeToVisit",
  "transportInfo",
  "budgetDetails",
  "stayDetails",
  "foodRecommendations",
  "hiddenSpots",
  "itinerary",
  "travelerTips",
  "ratings",
  "tags",
];

function pickUpdatableFields(body) {
  const update = {};
  for (const key of TRIP_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      update[key] = body[key];
    }
  }
  return update;
}

TripRoutes.post(
  "/trips",
  AuthMiddleware,
  // FIX: switched from upload.array("media", 10) to upload.fields(...) so
  // the request can carry two distinct sets of files: the general media
  // gallery, and (new) one photo per day-log journal entry when the
  // itinerary is built as a photo diary instead of written text.
  upload.fields([
    { name: "media", maxCount: 10 },
    { name: "dayLogMedia", maxCount: 20 },
  ]),
  async (req, res) => {
  try {
    const {
      title,
      description,
      city,
      state,
      country,
      boardingPoint,
      duration,
      tripType,
      bestTimeToVisit,
      transportMode,
      transportName,
      transportRoute,
      transportDuration,
      transportFare,
      transportTips,
      totalBudget,
      costPerPerson,
      stayCost,
      foodCost,
      transportCost,
      sightseeingCost,
      otherCost,
      hotelName,
      stayLocation,
      pricePerNight,
      stayType,
      stayRating,
      stayReview,
      worthIt,
      mustTryFoods,
      cafes,
      budgetFoodOptions,
      hiddenSpots,
      itineraryType,
      itineraryVideoUrl,
      itineraryText,
      dayLogEntries,
      travelerTips,
      overallRating,
      budgetRating,
      safetyRating,
      foodRating,
      stayRatingValue,
      transportRating,
      experienceRating,
      tags,
    } = req.body;

    const userId = req.user.id;

    if (!title || !description  || !boardingPoint || !duration || !totalBudget || !costPerPerson || !overallRating) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if(description.trim().length <50){
      return res.status(400).json({message:"Description must be at least 50 characters"})
    }
    if (transportMode && !VALID_TRANSPORTS.includes(transportMode)) {
      return res.status(400).json({ message: "Invalid transport mode" });
    }

    const generalFiles = req.files?.media || [];
    const dayLogFiles = req.files?.dayLogMedia || [];

    const uploadedMedia = generalFiles.map((file) => ({
      url: file.path,
      type: file.mimetype.startsWith("video") ? "video" : "image",
    }));

    const tripData = {
      userId,
      title: title.trim(),
      description: description.trim(),
      destination: { city, state, country: country || "India" },
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
        tips: safeParseArray(transportTips, "transportTips"),
      },
      budgetDetails: {
        totalBudget,
        // costPerPerson,
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
        mustTryFoods: safeParseArray(mustTryFoods, "mustTryFoods"),
        cafes: safeParseArray(cafes, "cafes"),
        budgetFoodOptions: safeParseArray(budgetFoodOptions, "budgetFoodOptions"),
      },
      hiddenSpots: safeParseArray(hiddenSpots, "hiddenSpots"),
      // FIX: build the itinerary from whichever mode was actually used,
      // instead of always reading a field ("itineraryDays") the frontend
      // never sent.
      itinerary: (() => {
        const type = itineraryType || "text";

        if (type === "photos") {
          const entries = safeParseArray(dayLogEntries, "dayLogEntries");
          // Not every day-log entry necessarily has a photo attached, so
          // files are only appended (client-side) for entries that have
          // one — `hasFile` tells us, per entry, whether to consume the
          // next item from the dayLogFiles queue, keeping the two
          // differently-sized arrays correctly aligned.
          let fileIndex = 0;
          const days = entries.map((entry) => ({
            day: entry.day,
            description: entry.caption,
            image: entry.hasFile ? dayLogFiles[fileIndex++]?.path : undefined,
          }));
          return { itineraryType: type, days };
        }

        if (type === "video") {
          return { itineraryType: type, videoUrl: itineraryVideoUrl };
        }

        return { itineraryType: type, rawText: itineraryText };
      })(),
      travelerTips: safeParseArray(travelerTips, "travelerTips"),
      ratings: {
        overall: overallRating,
        budget: budgetRating,
        safety: safetyRating,
        food: foodRating,
        stay: stayRatingValue,
        transport: transportRating,
        experience: experienceRating,
      },
      tags: safeParseArray(tags, "tags"),
      media: uploadedMedia,
    };

    // FIX: removed the old `validator.tripCreate(...)` call — that
    // function was never exported from utils/validator.js, so
    // `validator.tripCreate ? ... : { error: null }` always evaluated to
    // `{ error: null }`. It looked like validation was happening but
    // wasn't; Mongoose schema validation (below, via Trip.create) is the
    // real safety net here.
    const trip = await Trip.create(tripData);

    return res.status(201).json({ message: "Trip created successfully", trip });
  } catch (err) {
    console.error("Trip creation error:", err.message);

    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "Invalid data provided", errors: err.errors });
    }
    if (err.message?.startsWith("Invalid JSON")) {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
});

TripRoutes.get("/trips/my-trips", AuthMiddleware, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.status(200).json(trips);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your trips" });
  }
});

TripRoutes.get("/trips/feed", AuthMiddleware, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 6, 25);
    const skip = (page - 1) * limit;

    const { destination, minBudget, maxBudget, transportMode, minRating, tripType, sortBy, tag } =
      req.query;

    const filter = {};

    if (destination) {
      filter["destination.city"] = { $regex: destination, $options: "i" };
    }
    if (minBudget || maxBudget) {
      filter["budgetDetails.costPerPerson"] = {};
      if (minBudget) filter["budgetDetails.costPerPerson"].$gte = Number(minBudget);
      if (maxBudget) filter["budgetDetails.costPerPerson"].$lte = Number(maxBudget);
    }
    if (transportMode) filter["transportInfo.mode"] = transportMode;
    if (minRating) filter["ratings.overall"] = { $gte: Number(minRating) };
    if (tripType) filter.tripType = tripType;
    if (tag) filter.tags = { $in: [tag.toLowerCase()] };

    let sortOption = { createdAt: -1 };
    if (sortBy === "budget_low") sortOption = { "budgetDetails.costPerPerson": 1 };
    if (sortBy === "budget_high") sortOption = { "budgetDetails.costPerPerson": -1 };
    if (sortBy === "rating_high") sortOption = { "ratings.overall": -1 };

    // FIX: run the fetch and the count concurrently instead of sequentially
    // awaiting one after the other — halves the wall-clock latency of this
    // endpoint since both queries hit the same filter independently.
    const [trips, totalTrips] = await Promise.all([
      Trip.find(filter)
        .populate("userId", "name username photoURL")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Trip.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(totalTrips / limit),
      totalTrips,
      Trips: trips,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

TripRoutes.get("/trips/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid trip ID" });
    }
    const trip = await Trip.findById(id).populate("userId", "name username photoURL About").lean();
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }
    res.status(200).json(trip);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

TripRoutes.put("/trips/update/:id", AuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid trip ID" });
    }

    const trip = await Trip.findById(id).select("userId");
    if (!trip) {
      return res.status(404).json({ message: "Trip Not found" });
    }
    if (trip.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to update this trip" });
    }

    // FIX: only whitelisted fields reach the DB now — userId, timestamps,
    // and any unrecognized keys in the request body are ignored rather
    // than blindly written.
    const update = pickUpdatableFields(req.body);

    const updatedTrip = await Trip.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ message: "Trip updated successfully", updatedTrip });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "Invalid data provided", errors: err.errors });
    }
    res.status(400).json({ message: err.message });
  }
});

TripRoutes.delete("/trips/delete/:id", AuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid trip Id" });
    }
    const trip = await Trip.findById(id).select("userId");
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }
    if (trip.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to delete this trip" });
    }
    await Trip.findByIdAndDelete(id);
    res.status(200).json({ message: "Trip deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

TripRoutes.get("/trips/user/:id", AuthMiddleware, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.params.id })
      .populate("userId", "name username photoURL")
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(trips);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user trips" });
  }
});

module.exports = { TripRoutes };