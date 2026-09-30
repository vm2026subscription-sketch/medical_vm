const cloudinary = require('../../config/cloudinary');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');

/**
 * uploadImageBuffer — streams an in-memory image buffer (from multer memoryStorage) to
 * Cloudinary and returns the secure URL. Cloudinary handles resizing/optimization on the
 * fly via URL transformation params later — we just store the base secure_url here.
 */
function uploadImageBuffer(buffer, folder = 'medpath/colleges') {
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const gif = ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString());
  const webp = buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (!jpeg && !png && !gif && !webp) throw ApiError.badRequest('File contents must be a JPEG, PNG, GIF or WebP image');
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw ApiError.internal(
      'Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env'
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', allowed_formats: ['jpg', 'png', 'gif', 'webp'], timeout: 60000 },
      (err, result) => {
        if (err) return reject(ApiError.internal('Image upload to Cloudinary failed', err.message));
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function uploadAttachmentBuffer(buffer, filename) {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw ApiError.internal(
      'Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env'
    );
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'medpath/notification-attachments',
        resource_type: 'raw',
        use_filename: true,
        unique_filename: true,
        filename_override: filename,
        timeout: 60000,
      },
      (err, result) => {
        if (err) return reject(ApiError.internal('Attachment upload to Cloudinary failed', err.message));
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { uploadImageBuffer, uploadAttachmentBuffer };
