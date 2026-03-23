const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/user");
const Trip = require("../models/TripSchema");
const AuthMiddleware = require("../middleware/authMiddleware");
const validator = require("validator")

const TripRoutes = express.Router();

TripRoutes.post("/trips", AuthMiddleware, async (req, res) => {
  try {
    const {
      from,
      destination,
      duration,
      tripType,
      bestTimeToVisit,
      totalBudget,
      costPerPerson,
      transportation,
      localTravel,
      hotelName,
      hotelRating,
      stayCost,
      description,
      tips,
      pros,
      cons,
      overallRating,
      tags,
      media,
    } = req.body;

    // Extract userId from auth middleware
    const userId = req.user.id;

    // Custom validation for business rules
    if (!from || !destination || !duration || !totalBudget || !transportation || !overallRating) {
      return res.status(400).json({
        message: "Missing required fields: from, destination, duration, totalBudget, transportation, overallRating",
      });
    }

    if (from.toLowerCase() === destination.toLowerCase()) {
      return res.status(400).json({
        message: "From and destination cannot be the same",
      });
    }

    // Validate enums
    const validTripTypes = ["solo", "friends", "family", "couple"];
    const validTransports = ["train", "flight", "bus", "car", "other"];
    if (tripType && !validTripTypes.includes(tripType)) {
      return res.status(400).json({
        message: `Invalid tripType. Must be one of: ${validTripTypes.join(", ")}`,
      });
    }
    if (!validTransports.includes(transportation)) {
      return res.status(400).json({
        message: `Invalid transportation. Must be one of: ${validTransports.join(", ")}`,
      });
    }

    // Validate media array structure (if provided)
    if (media && !Array.isArray(media)) {
      return res.status(400).json({ message: "media must be an array" });
    }
    if (media && media.some(item => !item.url || (item.type && !["image", "video"].includes(item.type)))) {
      return res.status(400).json({ message: "Invalid media item: must have url and optional type (image/video)" });
    }

    // Use validator util (assuming it's Joi/express-validator) for structured input validation
    // Example: validator.tripCreate(req.body) - customize based on your validator impl
    const { error: validationError } = validator.tripCreate ? validator.tripCreate(req.body) : { error: null };
    if (validationError) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationError.details || validationError,
      });
    }

    // Create trip object matching schema exactly
    const tripData = {
      userId,
      from: from.trim(),
      destination: destination.trim(),
      duration,
      tripType: tripType || "friends", // default from schema
      bestTimeToVisit,
      totalBudget,
      costPerPerson,
      transportation,
      localTravel,
      hotelName,
      hotelRating,
      stayCost,
      description,
      tips,
      pros,
      cons,
      overallRating,
      tags: tags || [],
      media: media || [],
      // likes/saves auto-empty arrays from schema
    };

    const trip = await Trip.create(tripData);

    res.status(201).json({
      message: "Trip created successfully",
      trip,
    });
  } catch (err) {
    console.error("Trip creation error:", err); // Better logging
    // Mongoose validation errors are ValidationError
    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid data provided",
        errors: err.errors,
      });
    }
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

TripRoutes.get("/trips/my-trips", AuthMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const trips = await Trip.find({ userId })
      .sort({ createdAt: -1 });

    res.status(200).json(trips);

  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch your trips"
    });
  }
});

TripRoutes.get("/trips/feed", AuthMiddleware, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    let limit = parseInt(req.query.limit) || 3;
    limit = limit > 25 ? 25 : limit;
    const skip = (page - 1) * limit;

    const{
      destination,
      minBudget,
      maxBudget,
      transportation,
      minRating,
      sortBy
    } = req.query;
    let filter={
      userId:{$ne: req.user.id} //exclude the loggedin user
    }
    if(destination){
      filter.destination={$regex:destination,$options:"i"};
    }
    if(minBudget||maxBudget){
      filter.totalBudget={};
      if(minBudget) filter.totalBudget.$gte=Number(minBudget);
      if(maxBudget) filter.totalBudget.$lte=Number(maxBudget);
    }
    if(transportation){
      filter.transportation = transportation;
    }
    if (minRating) {
      filter.overallRating = { $gte: Number(minRating) };
    }
     // 🔹 Sorting logic
    let sortOption = { createdAt: -1 }; // default newest

    if (sortBy === "budget_low") {
      sortOption = { totalBudget: 1 };
    }

    if (sortBy === "budget_high") {
      sortOption = { totalBudget: -1 };
    }

    if (sortBy === "rating_high") {
      sortOption = { overallRating: -1 };
    }

    const Trips = await Trip.find(
      filter 
    )
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
TripRoutes.put("/trips/update/:id", AuthMiddleware,async(req,res)=>{
  try{
    const {id} =req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid trip ID" });
    }
    const trip= await Trip.findById(id);
    if(!trip){
      return res.status(404).json({message:"Trip Not found"});
    }
    if(trip.userId.toString()!==req.user.id){
      return res.status(403).json({
        message:"You are not authorized to update this trip"
      });
    }
    const updatedTrip = await Trip.findByIdAndUpdate(
      id,
      req.body,
      {new: true}
    );
    res.status(200).json({
      message:"Trip updated successfully",
      updatedTrip
    })
  }
  catch(err){
    res.status(400).send("ERROR:"+ err.message);
  }
})
TripRoutes.delete('/trips/delete/:id', AuthMiddleware, async(req,res)=>{
  try{
    const {id} = req.params;
    if(!mongoose.Types.ObjectId.isValid(id)){
      return res.status(400).json({message:"Invalid trip Id"});
    }
    const trip= await Trip.findById(id);

    if(!trip){
      return res.status(404).json({message:"Trip not found"});
    }
    if(trip.userId.toString()!==req.user.id){
      return res.status(403).json({
        message:"You are not authorized to delete this trip"
      });
    }
    await Trip.findByIdAndDelete(id);
    res.status(200).json({
      message:" Trip deleted successfully"
    });

  }
  catch(err){
    res.status(400).send("ERROR:"+ err.message);
  }
})

module.exports = { TripRoutes };
