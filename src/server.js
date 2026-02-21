const express = require('express');
const connectDb = require('./config/db');
const app=express();


connectDb().then(()=>{
    console.log("DB connected successfully");
    app.listen(5000,()=>{
        console.log("Server is running on port 5000");
    })
}).catch(()=>{
    console.error("Database connection is failed");
});