const express= require('express');
const {validateSignup}= require('../utils/validator');
const User = require('../models/user');
const bcrypt= require('bcryptjs');
const authMiddleware = require('../middleware/authMiddleware');

const authRouter = express.Router();

authRouter.post("/signup",async(req,res)=>{
    try{
        validateSignup(req);
        const {name,username,email,password,age,photoURL,About}= req.body;

        const passwordhash = await bcrypt.hash(password,10);

        const user = new User({
            name,
            username,
            email,
            password: passwordhash,
            age,
            photoURL,
            About

        })
        await user.save();
        res.send('user created successfully');


    }
    catch(err){
        res.status(400).send('ERROR:' + err.message);
    }
})

authRouter.post("/login", async(req,res)=>{
    try{
        const {email,password} = req.body;
        const user = await User.findOne({email});
        if(!user){
            throw new Error("Invalid email or password");
        }
       
    const isPasswordvalid = await user.validatePassword(password);
        if(!isPasswordvalid){
            throw new Error("Invalid credentials");
        }
        const token = await user.getJWT();
        res.cookie("token", token);
        res.send("Login successful");

    }
    catch(err){
        res.status(400).send("ERROR:" + err.message);
    }
})
authRouter.post('/logout',(req,res)=>{
  res.cookie("token", null,{ 
  expires: new Date(Date.now())
  })
  res.send("Logout successfully");
})
authRouter.get('/users/profile/view', authMiddleware, async(req,res)=>{
    try{
        const user = req.user;
        if(!user){
            throw new Error("User not found");
        }
        console.log(user)
        res.send(user);
    }
    catch(err){
        res.status(400).send("ERROR:"+err.message);
    }
})

module.exports = authRouter;