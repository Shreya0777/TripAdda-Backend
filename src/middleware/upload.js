const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/Cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "triptrail",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});


const upload = multer({ storage });

module.exports = upload;