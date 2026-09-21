const express = require('express');
const validate = require('../../middlewares/validate');
const { optionalAuth, requireAuth } = require('../../middlewares/auth');
const { attachEntitlement } = require('../../middlewares/checkEntitlement');
const schemas = require('./colleges.validation');
const controller = require('./colleges.controller');

const router = express.Router();

router.get('/', validate(schemas.listColleges), controller.list);
router.get('/categories', require('../../utils/catchAsync')(async (_req, res) => {
  res.json({ success: true, data: await require('../../utils/categoryCodes').listCategoryCodes({ includeSeats: true }) });
}));
router.get('/:id', validate(schemas.getCollege), optionalAuth(), attachEntitlement(), controller.getById);
router.post('/compare', validate(schemas.compareColleges), optionalAuth(), attachEntitlement(), controller.compare);
router.post('/:id/save', requireAuth(), validate(schemas.saveCollege), controller.save);
router.delete('/:id/save', requireAuth(), validate(schemas.getCollege), controller.unsave);

module.exports = router;
