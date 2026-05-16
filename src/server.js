require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit=require("express-rate-limit");
const passport = require("passport");
const connectDb = require("./config/db");
const dns = require("dns");
const authRouter = require("./routes/authRoutes");
const { usersRoute } = require("./routes/usersRoutes");
const { TripRoutes } = require("./routes/TripRoutrs");

const app = express();

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://trip-adda-frontend.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});

app.use(limiter);



app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/", authRouter);
app.use("/", usersRoute);
app.use("/", TripRoutes);

connectDb()
  .then(() => {
    console.log("DB connected successfully");

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });