const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authMiddleware = async(req,res,next)=>{
    try{
        const {token} = req.cookies;
        if(!token){
            throw new Error("Unauthorized: No token provided");
        }
        const decoded = jwt.verify(token,"Anjali@singh#123");
          const {_id}=decodeobj;
        const user = await User.findById(_id);
        if(!user){
            throw new Error("User not found");
        }
        req.user = user;
        next();

    }
    catch(err){
        res.status(400).send("ERROR:" + err.message);
    }
}

module.exports = authMiddleware;