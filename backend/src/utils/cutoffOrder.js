const stages = () => [
  { $addFields: { _roundOrder: { $indexOfArray: [['Round1', 'Round2', 'Round3', 'MopUp', 'Stray'], '$round'] } } },
  { $sort: { year: -1, _roundOrder: -1, updatedAt: -1, _id: 1 } },
  { $unset: '_roundOrder' },
];
module.exports = { stages };
