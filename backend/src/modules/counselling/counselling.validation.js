const { z } = require('zod');
const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const listSlots = {
  params: z.object({ id: mongoId }),
  query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Use a valid YYYY-MM-DD date') }),
};

const holdSlot = {
  params: z.object({ id: mongoId }), // slot id
};

const createBooking = {
  body: z.object({
    slotId: mongoId,
    holdToken: z.string().min(1),
    serviceId: mongoId,
    couponCode: z.string().optional(),
  }),
};

const reschedule = {
  params: z.object({ id: mongoId }), // booking id
  body: z.object({
    newSlotId: mongoId,
  }),
};

const feedback = {
  params: z.object({ id: mongoId }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    review: z.string().optional(),
  }),
};

module.exports = { listSlots, holdSlot, createBooking, reschedule, feedback };
