const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
        minLength: 4,
        maxLength: 15
    },
    username:{
         type :String,
         required: true,
         unique: true,
         maxLength: 15
    },
    email:{
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        unique: true,
        validator(value){
            if(!validator.isEmail(value)){
                throw new Error("Invalid email format");
            }
        }
    },
    password:{
        type: String,
        required: true,
        minLength: 8,
        validator(value){
            if(!validator.isStrongPassword(value)){
                throw new Error("Please enter strong password");
            }
        }
    },
    age:{
        type:Number,
        
    },
    photoURL:{
        type: String,
        default: "https://tse2.mm.bing.net/th/id/OIP.9k6NZTQk5G6g5PVDDDeLiAHaHa?pid=Api&P=0&h=180",
        validator(value){
            if(!validator.isURL(value)){
                throw new Error("Invalid URL format");
            }
        }

    },
    About:{
        type: String,
        default:"Hey there! I'm using Trip_Trail"
    }
},
{
    timestamps: true
});

userSchema.methods.getJWT = async function(){
    const user = this;
    const token= jwt.sign({id: user._id},"Anjali@singh#123",{expiresIn: "2d"});
    return token;
}

userSchema.methods.validatePassword = async function(passworduserInput){
    const user = this;
    const passwordhash = user.password;

    const isvalidatepassword = await bcrypt.compare(passworduserInput, passwordhash);
    return isvalidatepassword;
}

module.exports= mongoose.model("User",userSchema);



