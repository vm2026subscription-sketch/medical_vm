const multer = require('multer');
const ApiError = require('../utils/ApiError');

// Files are small admin CSVs — memory storage is fine; swap to disk/S3 streaming if imports
// grow beyond a few MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      return cb(ApiError.badRequest('Only .csv files are accepted for bulk import'));
    }
    cb(null, true);
  },
});

// Separate instance for image uploads (college photos) — accepts common image types,
// destined for Cloudinary rather than a CSV parser.
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(ApiError.badRequest('Only JPEG, PNG, WEBP or GIF images are accepted'));
    }
    cb(null, true);
  },
});

module.exports = upload;
module.exports.uploadImage = uploadImage;
