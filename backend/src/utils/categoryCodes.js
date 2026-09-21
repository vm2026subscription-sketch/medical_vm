const { z } = require('zod');

// Categories are authority-specific source labels, not a universal reservation enum.
const categorySchema = z.string().trim().min(1).max(80).refine((value) =>
  !Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127),
'Category must be a single-line code');

async function listCategoryCodes({ includeSeats = false, includeInactive = false } = {}) {
  const CutOff = require('../models/CutOff');
  const SeatMatrix = require('../models/SeatMatrix');
  let filter = {};
  if (!includeInactive) {
    const colleges = await require('../models/College').distinct('_id', { isActive: true });
    const links = await require('../models/CollegeCourse').distinct('_id', { collegeId: { $in: colleges } });
    filter = { collegeCourseId: { $in: links } };
  }
  const groups = await Promise.all([CutOff.distinct('category', filter), ...(includeSeats ? [SeatMatrix.distinct('category', filter)] : [])]);
  return [...new Set(groups.flat().filter((value) => typeof value === 'string' && value.trim()))].sort((a, b) => a.localeCompare(b));
}

module.exports = { categorySchema, listCategoryCodes };
