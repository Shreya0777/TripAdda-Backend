const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/Cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "triptrail",
    // FIX: only jpg/png/jpeg/mp4/mov/webm were allowed. iPhones and iPads
    // (Apple's default camera format since iOS 11) save photos as HEIC/HEIF,
    // which was silently rejected here — the very first real-device test
    // hit this. Broadened to cover the common phone camera formats.
    allowed_formats: [
      "jpg",
      "jpeg",
      "png",
      "heic",
      "heif",
      "webp",
      "gif",
      "mp4",
      "mov",
      "webm",
      "m4v",
      "3gp",
    ],
    resource_type: "auto",
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB/file — avoids one huge video stalling the whole request
});

module.exports = upload;