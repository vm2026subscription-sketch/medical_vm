jest.mock('../src/config/cloudinary', () => ({ uploader: { upload_stream: jest.fn() } }));
jest.mock('../src/config/env', () => ({ CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'test' }));
const cloudinary = require('../src/config/cloudinary');
const { uploadImageBuffer } = require('../src/modules/admin/media.service');

test('rejects text or SVG disguised as image content before sending it to Cloudinary', () => {
  expect(() => uploadImageBuffer(Buffer.from('<svg>not an allowed raster</svg>'))).toThrow(/File contents/);
  expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
});
test('streams valid raster content with a folder, format allowlist and timeout', async () => {
  const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const end = jest.fn();
  cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
    callback(null, { secure_url: 'https://example.com/campus.png' });
    return { end };
  });
  const result = await uploadImageBuffer(buffer, 'medpath/colleges/test');
  expect(result.secure_url).toBe('https://example.com/campus.png');
  expect(end).toHaveBeenCalledWith(buffer);
  expect(cloudinary.uploader.upload_stream.mock.calls[0][0]).toMatchObject({ folder: 'medpath/colleges/test', resource_type: 'image', timeout: 60000, allowed_formats: ['jpg', 'png', 'gif', 'webp'] });
});
