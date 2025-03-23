/**
 * Utility for generating random star names
 */

// Prefixes for star names
const prefixes = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", 
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi", "Rho", 
  "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega"
];

// Suffixes for star names
const suffixes = [
  "Centauri", "Cygni", "Draconis", "Eridani", "Hydri", "Leonis", "Orionis",
  "Persei", "Puppis", "Scorpii", "Tauri", "Ursa", "Velorum", "Virginis",
  "Andromedae", "Aquarii", "Arietis", "Aurigae", "Boötis", "Camelopardalis",
  "Cancri", "Canis", "Capricorni", "Carinae", "Cassiopeiae", "Cephei"
];

// Scientific designations
const designationPrefixes = ["HD", "HIP", "GJ", "BD", "LHS", "WISE", "Kepler", "TOI"];

/**
 * Generate a random star name
 * @returns {string} A randomly generated star name
 */
export function generateStarName() {
  // 50% chance for a traditional name
  if (Math.random() < 0.5) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${prefix} ${suffix}`;
  } 
  // 50% chance for a scientific designation with numbers
  else {
    const prefix = designationPrefixes[Math.floor(Math.random() * designationPrefixes.length)];
    const number = Math.floor(Math.random() * 99999) + 1000;
    return `${prefix} ${number}`;
  }
} 