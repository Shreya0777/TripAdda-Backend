const mongoose = require("mongoose");

const TripSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      required: true,
      maxlength: 3000,
    },

    destination: {
      city: { type: String, required: true, trim: true },
      state: { type: String, trim: true },
      country: { type: String, default: "India" },
    },

    boardingPoint: {
      type: String,
      required: true,
      trim: true,
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    tripType: {
      type: String,
      enum: ["solo", "friends", "family", "couple"],
      default: "friends",
    },

    bestTimeToVisit: { type: String },

    transportInfo: {
      mode: {
        type: String,
        enum: ["train", "flight", "bus", "car", "bike", "other"],
      },
      transportName: { type: String },
      route: { type: String },
      duration: { type: String },
      fare: { type: Number },
      tips: [String],
    },

    budgetDetails: {
      totalBudget: { type: Number, required: true },
      costPerPerson: { type: Number, required: true },
      stayCost: { type: Number, default: 0 },
      foodCost: { type: Number, default: 0 },
      transportCost: { type: Number, default: 0 },
      sightseeingCost: { type: Number, default: 0 },
      otherCost: { type: Number, default: 0 },
    },

    stayDetails: {
      hotelName: { type: String },
      location: { type: String },
      pricePerNight: { type: Number },
      stayType: {
        type: String,
        enum: ["hotel", "hostel", "homestay", "resort", "airbnb"],
      },
      rating: { type: Number, min: 1, max: 5 },
      stayReview: { type: String },
      worthIt: { type: Boolean, default: true },
    },

    foodRecommendations: {
      mustTryFoods: [String],
      cafes: [String],
      budgetFoodOptions: [String],
    },

    hiddenSpots: [
      {
        title: String,
        description: String,
        image: String,
      },
    ],

    itinerary: {
      // FIX: added "photos" — a day-by-day photo + caption journal, as an
      // alternative to writing a text itinerary from memory after the trip.
      itineraryType: {
        type: String,
        enum: ["text", "video", "photos"],
        default: "text",
      },

      videoUrl: { type: String },

      // FIX: the original text-mode itinerary ("Day Wise Itinerary"
      // textarea) had nowhere to actually land — the backend only ever
      // read a structured `itineraryDays` array that the frontend never
      // sent, so that field silently vanished on every submission. This
      // gives plain-text mode an explicit home, separate from the
      // structured per-day photo-journal entries below.
      rawText: { type: String },

      days: [
        {
          day: Number,
          title: String,
          description: String,
          // FIX: added so a "photos" itinerary can attach one image per
          // day-log entry, captured whenever the traveler logs that day.
          image: String,
        },
      ],
    },

    travelerTips: [String],

    ratings: {
      overall: { type: Number, min: 1, max: 5, required: true },
      budget: { type: Number, min: 1, max: 5 },
      safety: { type: Number, min: 1, max: 5 },
      food: { type: Number, min: 1, max: 5 },
      stay: { type: Number, min: 1, max: 5 },
      transport: { type: Number, min: 1, max: 5 },
      experience: { type: Number, min: 1, max: 5 },
    },

    tags: [{ type: String, lowercase: true, trim: true }],

    media: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video"], default: "image" },
      },
    ],
  },
  { timestamps: true },
);

TripSchema.index({ userId: 1, createdAt: -1 });
TripSchema.index({ "destination.city": 1 });
TripSchema.index({ tags: 1 });
TripSchema.index({ "ratings.overall": -1 });
TripSchema.index({ "budgetDetails.totalBudget": 1 });

module.exports = mongoose.model("Trip", TripSchema);