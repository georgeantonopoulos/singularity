import { THREE } from '../libs/three-setup.js';

// Define object types as constants
export const OBJECT_TYPES = {
  STAR: 'star',
  PLANET: 'planet',
  DEBRIS: 'debris'
};

export class CelestialObject {
  constructor(options = {}) {
    this.type = options.type || OBJECT_TYPES.STAR;
    this.mass = options.mass || 1;
    this.isAbsorbed = false;
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = options.velocity || new THREE.Vector3(0, 0, 0);
    this.color = options.color || new THREE.Color(0xffffff);
    this.showTrajectory = false; // Trajectories always disabled
    this._oscPhase = Math.random() * Math.PI * 2; // Random phase for z-oscillation
    this._oscSpeed = 0.5 + Math.random() * 0.5; // Random oscillation speed
    this._oscAmplitude = 0.2 + Math.random() * 0.3; // Random oscillation amplitude
    
    this.createMesh();
  }
  
  createMesh() {
    let geometry, material;
    
    // Size is proportional to mass
    const radius = Math.pow(this.mass, 1/3) * 0.8;
    
    if (this.type === OBJECT_TYPES.STAR) {
      // For stars, use a glow shader material with a 3D sphere geometry
      geometry = new THREE.SphereGeometry(radius, 32, 16);
      
      // Create a canvas texture with bright center for the diffuse map
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      
      // Draw a radial gradient for the star
      const gradient = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, 0,
        canvas.width/2, canvas.height/2, canvas.width/2
      );
      
      // Convert THREE.Color to CSS format
      const r = Math.floor(this.color.r * 255);
      const g = Math.floor(this.color.g * 255);
      const b = Math.floor(this.color.b * 255);
      
      // Create bright white center fading to the star's color
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);  // Original color
      gradient.addColorStop(1, `rgba(${r/2}, ${g/2}, ${b/2}, 0.1)`);  // Darker edge
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      
      // Create an emissive texture for the glow effect
      const emissiveCanvas = document.createElement('canvas');
      emissiveCanvas.width = 128;
      emissiveCanvas.height = 128;
      const emissiveCtx = emissiveCanvas.getContext('2d');
      
      // Create a more intense radial gradient for the emissive map
      const emissiveGradient = emissiveCtx.createRadialGradient(
        emissiveCanvas.width/2, emissiveCanvas.height/2, 0,
        emissiveCanvas.width/2, emissiveCanvas.height/2, emissiveCanvas.width/2
      );
      
      // Bright center with color-based outer glow
      emissiveGradient.addColorStop(0, `rgba(255, 255, 255, 1)`);  // White hot center
      emissiveGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.8)`);  // Original color
      emissiveGradient.addColorStop(1, `rgba(${r/3}, ${g/3}, ${b/3}, 0)`);  // Fade out
      
      emissiveCtx.fillStyle = emissiveGradient;
      emissiveCtx.fillRect(0, 0, emissiveCanvas.width, emissiveCanvas.height);
      
      const emissiveTexture = new THREE.CanvasTexture(emissiveCanvas);
      
      // Use MeshPhongMaterial with emissive properties for a glowing effect
      material = new THREE.MeshPhongMaterial({
        map: texture,
        emissive: new THREE.Color(this.color),
        emissiveMap: emissiveTexture,
        emissiveIntensity: 1.5,
        transparent: true,
        blending: THREE.AdditiveBlending,
        shininess: 100,
        depthWrite: false
      });
      
    } else if (this.type === OBJECT_TYPES.PLANET) {
      // For planets, use a 3D sphere with a texture
      geometry = new THREE.SphereGeometry(radius, 32, 16);
      
      // Create a texture for the planet
      const texture = this.createPlanetTexture();
      
      material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: false
      });
      
    } else { // DEBRIS
      geometry = new THREE.SphereGeometry(radius, 16, 8);
      
      material = new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: false
      });
    }
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    
    // Add some rotation
    if (this.type === OBJECT_TYPES.PLANET || this.type === OBJECT_TYPES.DEBRIS) {
      this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    } else {
      this.rotationSpeed = (Math.random() - 0.5) * 0.005; // Stars rotate slower
    }
  }
  
  createPlanetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Convert THREE.Color to CSS format
    const r = Math.floor(this.color.r * 255);
    const g = Math.floor(this.color.g * 255);
    const b = Math.floor(this.color.b * 255);
    
    // Fill with base color
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add some surface details/noise
    const darkColor = `rgba(${Math.max(0, r-30)}, ${Math.max(0, g-30)}, ${Math.max(0, b-30)}, 0.7)`;
    const lightColor = `rgba(${Math.min(255, r+30)}, ${Math.min(255, g+30)}, ${Math.min(255, b+30)}, 0.7)`;
    
    // Draw random "continents"
    ctx.fillStyle = darkColor;
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 5 + Math.random() * 20;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw lighter areas
    ctx.fillStyle = lightColor;
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 3 + Math.random() * 10;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Create texture from canvas
    return new THREE.CanvasTexture(canvas);
  }
  
  getRadius() {
    return Math.pow(this.mass, 1/3) * 0.8;
  }
  
  update(deltaTime, blackHole) {
    if (this.isAbsorbed) return;
    
    if (blackHole) {
      // Calculate gravitational force
      const force = blackHole.getGravitationalPull(this.position, this.mass);
      
      // Apply force to velocity (F = ma, so a = F/m)
      const acceleration = force.divideScalar(this.mass);
      
      // Apply a minimum acceleration to ensure objects don't stall in space
      const minAccelerationMagnitude = 0.05;
      if (acceleration.lengthSq() < minAccelerationMagnitude * minAccelerationMagnitude) {
        // If acceleration is too low, add a small component toward the black hole
        const dirToBlackHole = new THREE.Vector3().subVectors(blackHole.position, this.position).normalize();
        acceleration.add(dirToBlackHole.multiplyScalar(minAccelerationMagnitude));
      }
      
      // Apply stronger acceleration to objects that are moving very slowly
      if (this.velocity.lengthSq() < 0.1) {
        const boostFactor = 1.5;
        acceleration.multiplyScalar(boostFactor);
      }
      
      // Add a slight perpendicular component for more interesting orbits
      // This helps prevent objects from falling straight into the black hole
      if (Math.random() < 0.01) { // Occasionally add orbital perturbation
        const dirToBlackHole = new THREE.Vector3().subVectors(blackHole.position, this.position).normalize();
        const perpDirection = new THREE.Vector3(-dirToBlackHole.y, dirToBlackHole.x, 0).normalize();
        this.velocity.add(perpDirection.multiplyScalar(0.1));
      }
      
      this.velocity.add(acceleration.multiplyScalar(deltaTime));
    }
    
    // Add a small damping factor to prevent velocities from growing too large
    if (this.velocity.lengthSq() > 25) {
      this.velocity.multiplyScalar(0.98);
    }
    
    // Update position based on velocity
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    
    // Update mesh position
    this.mesh.position.x = this.position.x;
    this.mesh.position.y = this.position.y;
    
    // Add vertical oscillation based on type and time
    if (!this.isAbsorbed) {
      const time = performance.now() * 0.001;
      let zOffset = 0;
      
      if (this.type === OBJECT_TYPES.STAR) {
        // Slower, more subtle oscillation for stars
        zOffset = Math.sin(time * this._oscSpeed + this._oscPhase) * this._oscAmplitude;
      } else {
        // More pronounced oscillation for planets and debris 
        zOffset = Math.sin(time * this._oscSpeed + this._oscPhase) * this._oscAmplitude * 1.5;
        
        // Add some randomness to planet orbits in z-axis
        if (Math.random() < 0.005) { // Occasional slight z-velocity changes
          this._oscAmplitude = Math.max(0.1, Math.min(0.8, this._oscAmplitude + (Math.random() - 0.5) * 0.1));
        }
      }
      
      this.mesh.position.z = zOffset;
    }
    
    // Apply rotation
    if (this.mesh) {
      this.mesh.rotation.z += this.rotationSpeed;
    }
  }
  
  createTrajectoryLine(scene, blackHole) {
    if (!blackHole || !this.showTrajectory) return;
    
    // Create a line geometry to show trajectory path
    const points = this.calculateTrajectoryPoints(blackHole);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create line material with appropriate color
    let color;
    if (this.type === OBJECT_TYPES.STAR) {
      color = 0xffff00; // Yellow for stars
    } else if (this.type === OBJECT_TYPES.PLANET) {
      color = 0x00ffff; // Cyan for planets
    } else {
      color = 0xaaaaaa; // Gray for debris
    }
    
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    
    // Create the line and add to scene
    this.trajectoryLine = new THREE.Line(geometry, material);
    scene.add(this.trajectoryLine);
  }
  
  calculateTrajectoryPoints(blackHole) {
    if (!blackHole) return [];
    
    const points = [];
    const simulationSteps = 100; // Number of points to calculate
    const timeStep = 0.5; // Time increment for each step
    
    // Start with current position and velocity
    const simPosition = this.position.clone();
    const simVelocity = this.velocity.clone();
    
    // Add current position as first point
    points.push(simPosition.clone());
    
    // Simulate future positions
    for (let i = 0; i < simulationSteps; i++) {
      // Calculate gravitational force
      const force = blackHole.getGravitationalPull(simPosition, this.mass);
      
      // Apply force to velocity (F = ma, so a = F/m)
      const acceleration = force.divideScalar(this.mass);
      simVelocity.add(acceleration.multiplyScalar(timeStep));
      
      // Update position
      simPosition.add(simVelocity.clone().multiplyScalar(timeStep));
      
      // Add to points array
      points.push(simPosition.clone());
      
      // Break early if it gets too close to the black hole
      if (simPosition.distanceTo(blackHole.position) < blackHole.getRadius() * 2) {
        break;
      }
    }
    
    return points;
  }
  
  updateTrajectoryLine(blackHole) {
    if (!this.trajectoryLine || !blackHole) return;
    
    // Safety check: make sure trajectoryLine exists and is a THREE.Line
    if (!this.trajectoryLine.geometry) {
      console.warn("Invalid trajectory line geometry");
      return;
    }
    
    // Calculate new points
    const points = this.calculateTrajectoryPoints(blackHole);
    
    // Safety check: Make sure we have at least 2 points
    if (points.length < 2) {
      console.warn("Not enough trajectory points calculated");
      return;
    }
    
    // Update the line geometry
    this.trajectoryLine.geometry.dispose(); // Clean up
    this.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }
  
  // For collision detection
  getBoundingSphere() {
    return {
      position: this.position,
      radius: this.getRadius()
    };
  }
} 