const express= require('express');
const {validateSignup}= require('../utils/validator');
const User = require('../models/user');
const bcrypt= require('bcryptjs');

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
        const passwordMatch = await bcrypt.compare(password,user.password);
        if(!passwordMatch){
            throw new Error("Invalid credentials");
        }
        const token = await user.getJWT();

    }
    catch(err){
        res.status(400).send("ERROR:" + err.message);
    }
})

module.exports = authRouter;