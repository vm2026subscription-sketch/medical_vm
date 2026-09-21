/* eslint-disable no-console */
// Usage: npm run make-admin -- <phone-or-email>
// Example: npm run make-admin -- +919999999999
//          npm run make-admin -- aarav@example.com
//
// Promotes an existing (already signed-up) user to the super_admin role. The person must
// have logged in at least once via OTP before running this — the script only looks up
// existing users, it doesn't create one.
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');
const Role = require('../models/Role');
const AdminUser = require('../models/AdminUser');

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error('Usage: npm run make-admin -- <phone-or-email>');
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);

  const isEmail = identifier.includes('@');
  const user = await User.findOne(isEmail ? { email: identifier } : { phone: identifier });
  if (!user) {
    console.error(`No user found with ${isEmail ? 'email' : 'phone'} "${identifier}".`);
    console.error('Sign up / log in with this phone or email in the app first, then re-run this script.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Bootstrap the admin role without inserting any catalog or sample records.
  const role = await Role.findOneAndUpdate(
    { name: 'super_admin' },
    { $setOnInsert: { name: 'super_admin', permissions: ['*'] } },
    { upsert: true, new: true },
  );

  await User.findByIdAndUpdate(user._id, { $set: { role: 'admin' } });
  await AdminUser.findOneAndUpdate(
    { userId: user._id },
    { $set: { roleId: role._id } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  console.log(`✅ ${user.name || identifier} is now a super_admin.`);
  console.log('Log out and log back in on the frontend so the new role takes effect.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed to promote user to admin:', err.message);
  process.exit(1);
});
