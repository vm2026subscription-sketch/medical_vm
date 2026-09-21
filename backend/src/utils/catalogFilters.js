const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stateAliases = {
  Delhi: ['Delhi', 'New Delhi', 'NCT of Delhi', 'National Capital Territory of Delhi'],
  Odisha: ['Odisha', 'Orissa'],
  Puducherry: ['Puducherry', 'Pondicherry'],
  'Jammu and Kashmir': ['Jammu and Kashmir', 'Jammu & Kashmir'],
  'Andaman and Nicobar Islands': ['Andaman and Nicobar Islands', 'Andaman & Nicobar Islands'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Dadra and Nagar Haveli and Daman and Diu', 'Dadra and Nagar Haveli & Daman and Diu', 'Dadra & Nagar Haveli and Daman & Diu', 'Dadra and Nagar Haveli', 'Daman and Diu'],
};
function stateMatch(value) {
  const key = Object.keys(stateAliases).find((state) => stateAliases[state].some((alias) => alias.toLowerCase() === value.toLowerCase()));
  return new RegExp(`^(${(stateAliases[key] || [value]).map(escapeRegex).join('|')})$`, 'i');
}
module.exports = { escapeRegex, stateMatch };
