const express = require('express');
const validate = require('../../middlewares/validate');
const schemas = require('./courses.validation');
const controller = require('./courses.controller');

const router = express.Router();

router.get('/', controller.list);
router.get('/:slug', validate(schemas.getCourse), controller.getBySlug);

module.exports = router;
