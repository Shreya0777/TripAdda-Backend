require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const passport = require("passport");
const dns = require("dns");
const connectDb = require("./config/db");

// FIX: this is now the *only* place the Google strategy is registered.
// authRoutes.js previously redefined it inline with slightly different
// logic — whichever one ran "won last", which is a landmine.
require("./config/Passport");

const authRouter = require("./routes/authRoutes");
const { usersRoute } = require("./routes/usersRoutes");
const { TripRoutes } = require("./routes/TripRoutrs");

const app = express();
app.set("trust proxy", 1);

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

// FIX: allowed origins now come from env (comma-separated) with the old
// list as a fallback default, instead of being hardcoded — so staging/
// preview deployments don't require a code change + redeploy just to
// add an origin.
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,http://localhost:5174,https://trip-adda-frontend.vercel.app"
)
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use(limiter);

app.use("/", authRouter);
app.use("/", usersRoute);
app.use("/", TripRoutes);

// FIX: previously, any error thrown before a route's own try/catch could
// run (e.g. a file-format rejection inside the upload middleware, which
// happens *before* the route handler even starts) fell through to
// Express's bare default error page — a blank "Internal Server Error"
// with zero detail, in both the browser and the response body. This
// catches anything that escapes and returns something you can actually
// read, plus logs the real error server-side.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);

  if (err.message && err.message.includes("File type not allowed")) {
    return res.status(400).json({ message: "That file type isn't supported. Try a JPG, PNG, or common video format." });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "One of your files is too large (25MB limit per file)." });
  }

  res.status(500).json({ message: "Something went wrong on our end. Please try again." });
});

connectDb()
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log("Server is running");
    });
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });