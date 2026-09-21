const express = require('express');
const request = require('supertest');
const upload = require('../src/middlewares/upload');

const app = express();
const respond = (req, res) => res.json({
  name: req.file.originalname,
  size: req.file.size,
  content: req.file.buffer.toString(),
});
app.post('/csv', upload.single('file'), respond);
app.post('/image', upload.uploadImage.single('file'), respond);
app.use((err, req, res, next) => res.status(400).json({ message: err.message, code: err.code }));

describe('upload middleware', () => {
  it('keeps uploaded CSV contents available for bulk import', async () => {
    const content = 'name,city\nExample College,Pune\n';
    const res = await request(app).post('/csv').attach('file', Buffer.from(content), 'colleges.csv');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'colleges.csv', size: Buffer.byteLength(content), content });
  });

  it('rejects non-CSV files on the bulk import endpoint', async () => {
    const res = await request(app).post('/csv').attach('file', Buffer.from('{}'), 'data.json');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Only .csv/);
  });

  it('accepts image uploads and rejects unsupported MIME types', async () => {
    const image = await request(app).post('/image')
      .attach('file', Buffer.from('image bytes'), { filename: 'college.png', contentType: 'image/png' });
    expect(image.status).toBe(200);
    expect(image.body.content).toBe('image bytes');

    const other = await request(app).post('/image')
      .attach('file', Buffer.from('plain text'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(other.status).toBe(400);
    expect(other.body.message).toMatch(/Only JPEG/);
  });

  it('enforces the image size limit', async () => {
    const res = await request(app).post('/image')
      .attach('file', Buffer.alloc(8 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LIMIT_FILE_SIZE');
  });
});
