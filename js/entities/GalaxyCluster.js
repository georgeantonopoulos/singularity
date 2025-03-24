/**
 * GalaxyCluster class – creates a cluster of stars (and their orbiting planets)
 * using minimal modifications to the existing CelestialObject structure.
 */
import { CelestialObject, OBJECT_TYPES } from './CelestialObject.js';
import * as THREE from 'three';

export class GalaxyCluster {
  constructor(options = {}) {
    // Default properties
    this.position = options.position || new THREE.Vector3(0, 0, 0);
    this.type = options.type || 'standard'; // standard, binary, dense, sparse
    this.size = options.size || 'medium'; // small, medium, large
    this.scene = options.scene;
    
    // Object collections
    this.stars = [];
    this.planets = [];
    this.debris = [];
    
    // Create the cluster based on type
    this.createCluster();
  }
  
  createCluster() {
    // Determine cluster parameters based on size and type
    const params = this.getClusterParameters();
    
    // Create the central star(s)
    this.createCentralStars(params);
    
    // Create orbiting planets
    this.createPlanets(params);
    
    // Add debris
    this.createDebris(params);
  }
  
  getClusterParameters() {
    // Base parameters
    let params = {
      starCount: 1,
      planetCount: 0,
      debrisCount: 0,
      clusterRadius: 0,
      starMassRange: [3, 6],
      planetMassRange: [0.2, 1],
      debrisMassRange: [0.05, 0.2]
    };
    
    // Adjust based on cluster size
    switch (this.size) {
      case 'small':
        params.planetCount = 2 + Math.floor(Math.random() * 2);
        params.debrisCount = 3 + Math.floor(Math.random() * 3);
        params.clusterRadius = 10;
        break;
      case 'medium':
        params.planetCount = 3 + Math.floor(Math.random() * 3);
        params.debrisCount = 5 + Math.floor(Math.random() * 5);
        params.clusterRadius = 15;
        break;
      case 'large':
        params.planetCount = 5 + Math.floor(Math.random() * 4);
        params.debrisCount = 8 + Math.floor(Math.random() * 7);
        params.clusterRadius = 20;
        break;
    }
    
    // Adjust based on cluster type
    switch (this.type) {
      case 'binary':
        params.starCount = 2;
        params.planetCount = Math.floor(params.planetCount * 1.2);
        params.starMassRange = [2, 5];
        break;
      case 'dense':
        params.planetCount = Math.floor(params.planetCount * 1.5);
        params.debrisCount = Math.floor(params.debrisCount * 1.5);
        params.clusterRadius = params.clusterRadius * 0.7;
        break;
      case 'sparse':
        params.planetCount = Math.floor(params.planetCount * 0.7);
        params.clusterRadius = params.clusterRadius * 1.3;
        break;
    }
    
    return params;
  }
  
  createCentralStars(params) {
    // Create central star(s)
    for (let i = 0; i < params.starCount; i++) {
      // Star properties
      const mass = params.starMassRange[0] + Math.random() * (params.starMassRange[1] - params.starMassRange[0]);
      
      // Random bright star color
      const colorTemp = 5000 + Math.random() * 15000; // Color temperature in Kelvin
      const color = this.getStarColorFromTemperature(colorTemp);
      
      // Create star
      const star = new CelestialObject({
        type: OBJECT_TYPES.STAR,
        mass: mass,
        color: color,
        showTrajectory: false
      });
      
      // Position the star
      if (params.starCount === 1) {
        // Single star at cluster center
        star.position.copy(this.position);
      } else {
        // Binary star system - position stars on opposite sides
        const offset = 2 + Math.random() * 2; // Distance between stars
        const angle = i * Math.PI + (Math.random() * 0.2 - 0.1); // Opposite sides with small variation
        
        star.position.set(
          this.position.x + Math.cos(angle) * offset,
          this.position.y + Math.sin(angle) * offset,
          this.position.z
        );
        
        // Add orbital velocity for binary stars to orbit each other
        const orbitalSpeed = 0.5 + Math.random() * 0.3;
        star.velocity.set(
          -Math.sin(angle) * orbitalSpeed,
          Math.cos(angle) * orbitalSpeed,
          0
        );
      }
      
      star.mesh.position.copy(star.position);
      this.stars.push(star);
    }
  }
  
  createPlanets(params) {
    // Create planets that orbit the stars
    for (let i = 0; i < params.planetCount; i++) {
      // Planet properties
      const mass = params.planetMassRange[0] + Math.random() * (params.planetMassRange[1] - params.planetMassRange[0]);
      
      // Random planet color
      const hue = Math.random() * 360;
      const sat = Math.random() * 50 + 50;
      const light = Math.random() * 30 + 35;
      const color = new THREE.Color(`hsl(${hue}, ${sat}%, ${light}%)`);
      
      // Select parent star for this planet
      const parentStar = this.stars[Math.floor(Math.random() * this.stars.length)];
      
      // Calculate orbital parameters
      const orbitalRadius = 3 + Math.random() * (params.clusterRadius - 3);
      const orbitalSpeed = 0.2 + Math.random() * 0.3;
      const orbitalPhase = Math.random() * Math.PI * 2;
      const orbitalInclination = Math.random() * 0.2 - 0.1; // Small inclination for realism
      
      // Create planet
      const planet = new CelestialObject({
        type: OBJECT_TYPES.PLANET,
        mass: mass,
        color: color,
        showTrajectory: false,
        parent: parentStar,
        orbitalRadius: orbitalRadius,
        orbitalSpeed: orbitalSpeed,
        orbitalPhase: orbitalPhase,
        orbitalInclination: orbitalInclination
      });
      
      // Set initial position based on orbit
      planet.updateOrbit(0);
      
      this.planets.push(planet);
    }
  }
  
  createDebris(params) {
    // Create debris in the cluster
    for (let i = 0; i < params.debrisCount; i++) {
      // Debris properties
      const mass = params.debrisMassRange[0] + Math.random() * (params.debrisMassRange[1] - params.debrisMassRange[0]);
      const color = new THREE.Color(0.4, 0.4, 0.4); // Gray color for debris
      
      // Random position within cluster
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * params.clusterRadius;
      const x = this.position.x + Math.cos(angle) * distance;
      const y = this.position.y + Math.sin(angle) * distance;
      const z = (Math.random() - 0.5) * 2; // Small z variation
      
      // Create debris
      const debris = new CelestialObject({
        type: OBJECT_TYPES.DEBRIS,
        mass: mass,
        color: color,
        showTrajectory: false
      });
      
      // Position
      debris.position.set(x, y, z);
      debris.mesh.position.copy(debris.position);
      
      // Random velocity - mostly orbital but with some variation
      const orbitalAngle = angle + Math.PI/2 + (Math.random() - 0.5) * 0.5;
      const speed = 0.2 + Math.random() * 0.4;
      
      debris.velocity.set(
        Math.cos(orbitalAngle) * speed,
        Math.sin(orbitalAngle) * speed,
        (Math.random() - 0.5) * 0.1
      );
      
      this.debris.push(debris);
    }
  }
  
  // Helper method to get a realistic star color based on temperature
  getStarColorFromTemperature(temp) {
    let r, g, b;
    
    // Approximate star color based on temperature (in Kelvin)
    // Based on simplified blackbody radiation calculation
    
    if (temp <= 6600) {
      r = 1;
      g = 0.0139 * temp / 100 - 0.4;
      g = Math.min(1, Math.max(0, g));
      
      if (temp <= 2000) {
        b = 0;
      } else {
        b = 0.0256 * temp / 100 - 0.5;
        b = Math.min(1, Math.max(0, b));
      }
    } else {
      r = 1.286 / (Math.pow(temp / 6600, 0.42));
      r = Math.min(1, Math.max(0, r));
      g = 1;
      b = 1;
    }
    
    // Brighten the star colors a bit for visual appeal
    const brightnessFactor = 0.2;
    r = Math.min(1, r + brightnessFactor);
    g = Math.min(1, g + brightnessFactor);
    b = Math.min(1, b + brightnessFactor);
    
    return new THREE.Color(r, g, b);
  }
  
  // Get all objects in this cluster
  getAllObjects() {
    return [...this.stars, ...this.planets, ...this.debris];
  }
  
  // Update the cluster
  update(deltaTime) {
    // Update all objects in the cluster
    this.getAllObjects().forEach(obj => obj.update(deltaTime));
  }
} 