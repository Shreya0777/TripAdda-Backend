const validator = require('validator');

const validateSignup =(req)=>{

    const {name,email,password} = req.body;

    if(!name ){
        return {error:"Name is required"};
    }
    else if(!validator.isEmail(email)){
        throw new Error("Invalid email format");
    }
    else if(!validator.isStrongPassword(password)){
        throw new Error("Password must be at least 8 characters long and contain at least one uppercase letter,one lowercase letter,one special character and one numeric digit");
  }
}

const validateUpdateProfile= (req)=>{
    const AllowedUpdateFields=["name","username","password","age","gender","photoURL","About"];
    const isAllowed = Object.keys(req.body).every((field)=>( AllowedUpdateFields.includes(field)));
    return isAllowed;

}

module.exports = {validateSignup,validateUpdateProfile};