const express = require('express');
const controller = require('./content.controller');

const router = express.Router();

router.get('/blogs', controller.listBlogs);
router.get('/blogs/:slug', controller.getBlog);
router.get('/faqs', controller.listFaqs);
router.get('/downloads', controller.listDownloads);

module.exports = router;
