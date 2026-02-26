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
