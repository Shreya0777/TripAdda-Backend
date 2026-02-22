const express = require('express');
const connectDb = require('./config/db');
const app=express();
const User = require('./models/user');
const cookiesparser = require('cookie-parser');
const authRouter = require('./routes/authRoutes');

app.use(express.json());
app.use(cookiesparser());
app.use('/',authRouter);


connectDb().then(()=>{
    console.log("DB connected successfully");
    app.listen(5000,()=>{
        console.log("Server is running on port 5000");
    })
}).catch(()=>{
    console.error("Database connection is failed");
});