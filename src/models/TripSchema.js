const mongoose = require("mongoose");

const TripSchema = new mongoose.Schema(
  {
    // 👤 User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 📝 Basic Info
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

    // 📍 Destination Info
    destination: {
      city: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        trim: true,
      },

      country: {
        type: String,
        default: "India",
      },
    },

    // 🚏 Boarding Point
    boardingPoint: {
      type: String,
      required: true,
      trim: true,
    },

    // 📅 Trip Details
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

    bestTimeToVisit: {
      type: String,
    },

    // 🚗 Transport Section
    transportInfo: {
      mode: {
        type: String,
        enum: ["train", "flight", "bus", "car", "bike", "other"],
      },

      transportName: {
        type: String,
      },

      route: {
        type: String,
      },

      duration: {
        type: String,
      },

      fare: {
        type: Number,
      },

      tips: [String],
    },

    // 💰 Budget Section
    budgetDetails: {
      totalBudget: {
        type: Number,
        required: true,
      },

      costPerPerson: {
        type: Number,
        required: true,
      },

      stayCost: {
        type: Number,
        default: 0,
      },

      foodCost: {
        type: Number,
        default: 0,
      },

      transportCost: {
        type: Number,
        default: 0,
      },

      sightseeingCost: {
        type: Number,
        default: 0,
      },

      otherCost: {
        type: Number,
        default: 0,
      },
    },

    // 🏨 Stay Details
    stayDetails: {
      hotelName: {
        type: String,
      },

      location: {
        type: String,
      },

      pricePerNight: {
        type: Number,
      },

      stayType: {
        type: String,
        enum: ["hotel", "hostel", "homestay", "resort", "airbnb"],
      },

      rating: {
        type: Number,
        min: 1,
        max: 5,
      },

      stayReview: {
        type: String,
      },

      worthIt: {
        type: Boolean,
        default: true,
      },
    },

    // 🍜 Food Recommendations
    foodRecommendations: {
      mustTryFoods: [String],

      cafes: [String],

      budgetFoodOptions: [String],
    },

    // 🌄 Hidden Spots
    hiddenSpots: [
      {
        title: String,

        description: String,

        image: String,
      },
    ],

    // 🗓 Itinerary
    itinerary: {
      itineraryType: {
        type: String,
        enum: ["text", "video"],
        default: "text",
      },

      videoUrl: {
        type: String,
      },

      days: [
        {
          day: Number,

          title: String,

          description: String,
        },
      ],
    },

    // 💡 Traveler Tips
    travelerTips: [String],

    // ⭐ Ratings
    ratings: {
      overall: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
      },

      budget: {
        type: Number,
        min: 1,
        max: 5,
      },

      safety: {
        type: Number,
        min: 1,
        max: 5,
      },

      food: {
        type: Number,
        min: 1,
        max: 5,
      },

      stay: {
        type: Number,
        min: 1,
        max: 5,
      },

      transport: {
        type: Number,
        min: 1,
        max: 5,
      },

      experience: {
        type: Number,
        min: 1,
        max: 5,
      },
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
  },

  { timestamps: true }
);

module.exports = mongoose.model("Trip", TripSchema);