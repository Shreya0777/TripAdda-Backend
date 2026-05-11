const express = require("express");
const User = require("../models/user");
const authMiddleware = require("../middleware/authMiddleware");
usersRoute = express.Router();
const { validateUpdateProfile } = require("../utils/validator");


usersRoute.patch("/users/profile/update", authMiddleware, async (req, res) => {
  try {
    if (!validateUpdateProfile(req)) {
      throw new Error("This fields are not allowed to update");
    }
    const loggedInuser = req.user;
    Object.keys(req.body).forEach((key) => (loggedInuser[key] = req.body[key]));
   await loggedInuser.save();
    res.send(`Your profile is updated successfully`);
  } catch (err) {
    res.status(400).send("Error:" + err.message);
  }
});
usersRoute.get("users/profile/view" , async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching profile" });
  }
});



module.exports={usersRoute}