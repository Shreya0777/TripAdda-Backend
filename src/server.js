const express = require('express');
const connectDb = require('./config/db');
const app=express();
const User = require('./models/user');
const cookiesparser = require('cookie-parser');
const authRouter = require('./routes/authRoutes');
const {usersRoute} = require('./routes/usersRoutes')
const {TripRoutes} = require('./routes/TripRoutrs');
const cors = require("cors");
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);          // Google/Cloudflare
dns.setDefaultResultOrder('ipv4first');


app.use(cors({
  origin: "http://localhost:5173", // frontend URL
  credentials: true
}));


app.use(express.json());
app.use(cookiesparser());
app.use('/',authRouter);
app.use('/',usersRoute);
app.use('/',TripRoutes);


connectDb().then(()=>{
    console.log("DB connected successfully");
    app.listen(5000,()=>{
        console.log("Server is running on port 5000");
    })
}).catch(()=>{
    console.error("Database connection is failed");
});