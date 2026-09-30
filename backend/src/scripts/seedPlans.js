/* eslint-disable no-console */
const mongoose = require('mongoose');
const env = require('../config/env');
const Plan = require('../models/Plan');

const PLANS = [
  {
    name: 'Free',
    slug: 'free',
    price: 0,
    durationDays: 120,
    features: ['First 5 matching cutoff rows', 'Browse colleges, courses and counselling'],
  },
  {
    name: 'Season Pass',
    slug: 'cutoff-access',
    price: 99,
    durationDays: 120,
    features: [
      'Complete closing-rank cutoff database',
      'Every row with category, quota and year filters',
      'Valid for 120 days from purchase',
    ],
  },
];

async function main() {
  await mongoose.connect(env.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    for (const plan of PLANS) {
      const existed = await Plan.exists({ slug: plan.slug });
      const saved = await Plan.findOneAndUpdate(
        { slug: plan.slug },
        { $set: { name: plan.name, price: plan.price, durationDays: plan.durationDays, features: plan.features, isActive: true } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      console.log(`${existed ? 'updated' : 'created'} ${saved.name} (${saved.slug}) — ₹${saved.price} / ${saved.durationDays} days`);
    }
    console.log('Plans are ready. The upgrade page reads them from the database, so no restart is needed.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Plan seeding failed.', error.code === 11000 ? 'A plan already uses one of these slugs.' : error.message);
  process.exitCode = 1;
});
