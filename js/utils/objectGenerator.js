import { THREE } from '../libs/three-setup.js';
import { CelestialObject, OBJECT_TYPES } from '../entities/CelestialObject.js';

// Generate a random position within a specified range
function getRandomPosition(minRadius, maxRadius) {
  // Create a position vector with random spherical coordinates
  const radius = minRadius + Math.random() * (maxRadius - minRadius);
  const theta = Math.random() * Math.PI * 2; // Angle around y-axis
  const phi = Math.acos(2 * Math.random() - 1); // Angle from y-axis
  
  // Convert spherical coordinates to Cartesian
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  
  return new THREE.Vector3(x, y, z);
}

// Generate a random orbital velocity for an object at a given position
function getRandomOrbitalVelocity(position, orbitSpeedFactor) {
  // Calculate a velocity perpendicular to the position vector (for circular orbit)
  const posLength = position.length();
  const speed = orbitSpeedFactor / Math.sqrt(posLength); // Simplified orbital mechanics
  
  // Create a random perpendicular vector
  const randomVector = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  ).normalize();
  
  // Make it perpendicular to position vector
  const perpVector = new THREE.Vector3().crossVectors(position, randomVector).normalize();
  
  // Return orbital velocity
  return perpVector.multiplyScalar(speed);
}

// Get color based on object type
function getObjectColor(type) {
  switch (type) {
    case OBJECT_TYPES.STAR:
      // Stars range from blue to red
      const colorTemperature = Math.random();
      if (colorTemperature < 0.2) {
        // Blue stars (hot)
        return new THREE.Color(0x8080ff);
      } else if (colorTemperature < 0.4) {
        // White stars
        return new THREE.Color(0xffffff);
      } else if (colorTemperature < 0.7) {
        // Yellow stars
        return new THREE.Color(0xffff80);
      } else {
        // Red stars (cool)
        return new THREE.Color(0xff8080);
      }
    
    case OBJECT_TYPES.PLANET:
      // Planets with more varied colors
      const planetType = Math.random();
      if (planetType < 0.3) {
        // Earth-like
        return new THREE.Color(0x4040ff);
      } else if (planetType < 0.6) {
        // Mars-like
        return new THREE.Color(0xc04000);
      } else if (planetType < 0.8) {
        // Gas giant
        return new THREE.Color(0xc08040);
      } else {
        // Ice planet
        return new THREE.Color(0x80c0ff);
      }
    
    case OBJECT_TYPES.DEBRIS:
      // Grey-ish debris
      return new THREE.Color(0x808080);
    
    default:
      return new THREE.Color(0xffffff);
  }
}

// Get random mass based on object type
function getRandomMass(type) {
  switch (type) {
    case OBJECT_TYPES.STAR:
      // Stars are more massive
      return 0.8 + Math.random() * 2.2; // 0.8 to 3 solar masses
    
    case OBJECT_TYPES.PLANET:
      // Planets are medium mass
      return 0.1 + Math.random() * 0.5; // 0.1 to 0.6 solar masses
    
    case OBJECT_TYPES.DEBRIS:
      // Debris is small
      return 0.01 + Math.random() * 0.09; // 0.01 to 0.1 solar masses
    
    default:
      return 0.1;
  }
}

// Main function to generate celestial objects
export function generateCelestialObjects(count, options = {}) {
  const celestialObjects = [];
  const minRadius = options.minRadius || 10;
  const maxRadius = options.maxRadius || 50;
  const orbitSpeedFactor = options.orbitSpeedFactor || 2;
  
  // Default probabilities if not specified
  const starProbability = options.starProbability !== undefined ? options.starProbability : 0.3;
  const planetProbability = options.planetProbability !== undefined ? options.planetProbability : 0.5;
  const debrisProbability = options.debrisProbability !== undefined ? options.debrisProbability : 0.2;
  
  // Normalize probabilities
  const totalProb = starProbability + planetProbability + debrisProbability;
  const normalizedStarProb = starProbability / totalProb;
  const normalizedPlanetProb = planetProbability / totalProb;
  
  for (let i = 0; i < count; i++) {
    // Determine object type
    let type;
    const typeRoll = Math.random();
    
    if (typeRoll < normalizedStarProb) {
      type = OBJECT_TYPES.STAR;
    } else if (typeRoll < normalizedStarProb + normalizedPlanetProb) {
      type = OBJECT_TYPES.PLANET;
    } else {
      type = OBJECT_TYPES.DEBRIS;
    }
    
    // Get random position and velocity
    const position = getRandomPosition(minRadius, maxRadius);
    const velocity = getRandomOrbitalVelocity(position, orbitSpeedFactor);
    
    // Get color and mass based on type
    const color = getObjectColor(type);
    const mass = getRandomMass(type);
    
    // Create the celestial object
    const celestialObject = new CelestialObject({
      type,
      mass,
      position,
      velocity,
      color: color.getHex(),
      showTrajectory: i < 5 // Only show trajectory for a few objects to avoid clutter
    });
    
    celestialObjects.push(celestialObject);
  }
  
  return celestialObjects;
} 