const User = require('../../models/User');
const StudentProfile = require('../../models/StudentProfile');

async function getMyProfile(userId) {
  const [user, profile] = await Promise.all([
    User.findById(userId).lean(),
    StudentProfile.findOne({ userId }).lean(),
  ]);
  return { user, profile };
}

async function updateMyProfile(userId, data) {
  const { name, ...profileFields } = data;

  if (name) {
    await User.findByIdAndUpdate(userId, { $set: { name } });
  }

  const profile = await StudentProfile.findOneAndUpdate(
    { userId },
    { $set: profileFields },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return profile;
}

module.exports = { getMyProfile, updateMyProfile };
