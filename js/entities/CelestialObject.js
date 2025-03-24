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
    
    // New properties for hierarchical orbital dynamics
    this.parent = options.parent || null;
    this.children = [];
    this.orbitalRadius = options.orbitalRadius || 0;
    this.orbitalSpeed = options.orbitalSpeed || 0;
    this.orbitalPhase = options.orbitalPhase || Math.random() * Math.PI * 2;
    this.orbitalInclination = options.orbitalInclination || (Math.random() * 0.2);
    
    if (this.parent && this.parent instanceof CelestialObject) {
      this.parent.children.push(this);
    }
    
    // Set initial position from options if provided
    if (options.position && options.position instanceof THREE.Vector3) {
      this.position.copy(options.position);
    }
    
    this.createMesh();
  }
  
  createMesh() {
    const radius = this.getRadius();
    
    let geometry, material;
    
    if (this.type === OBJECT_TYPES.STAR) {
      // Create a group to hold all star components
      this.mesh = new THREE.Group();
      this.mesh.position.copy(this.position);
      
      // Core of the star - solid sphere for depth and shadows - brightened for bloom
      geometry = new THREE.SphereGeometry(radius * 0.6, 24, 16);
      material = new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: false,
        depthWrite: true
      });
      
      // Intensify the color to trigger bloom
      const brightColor = new THREE.Color(this.color).multiplyScalar(1.5);
      material.color = brightColor;
      
      const coreMesh = new THREE.Mesh(geometry, material);
      this.mesh.add(coreMesh);
      
      // Create a volumetric star effect using multiple intersecting planes
      // Each plane will be positioned at a different angle to create a 3D effect
      const starMaterial = this.createStarShaderMaterial(radius);
      
      // Create multiple intersecting planes to give 3D volume appearance
      const planeSize = radius * 15;
      
      // Function to create a plane at a specific rotation
      const createStarPlane = (rotationY, rotationZ) => {
        const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const plane = new THREE.Mesh(planeGeometry, starMaterial.clone());
        
        // Apply rotation to create 3D star shape
        plane.rotation.y = rotationY;
        plane.rotation.z = rotationZ;
        
        // Disable lookAt for a more volumetric appearance
        return plane;
      };
      
      // Create 4 planes at 45-degree angles to form a cross
      const planes = [
        createStarPlane(0, 0),                         // Front-facing
        createStarPlane(Math.PI / 2, 0),               // Side-facing
        createStarPlane(Math.PI / 4, Math.PI / 4),     // Diagonal 1
        createStarPlane(-Math.PI / 4, Math.PI / 4)     // Diagonal 2
      ];
      
      // Add all planes to the star mesh
      planes.forEach(plane => this.mesh.add(plane));
      
      // Add these planes to the object for animation access
      this.starPlanes = planes;
      
      // Add a volumetric glow sphere - enhanced for bloom
      const glowGeometry = new THREE.SphereGeometry(radius * 1.5, 32, 16);
      const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0.0 },
          color: { value: new THREE.Color(this.color).multiplyScalar(1.3) }, // Brighter color
          intensity: { value: 0.8 } // Increased intensity
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          uniform vec3 color;
          uniform float intensity;
          
          varying vec3 vNormal;
          varying vec3 vPosition;
          
          void main() {
            // Calculate fresnel effect (stronger at grazing angles)
            float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
            
            // Add subtle pulsing
            float pulse = 0.85 + 0.15 * sin(time * 1.5);
            
            // Combine effects - amplified for bloom
            vec3 glowColor = color * (fresnel * 1.8 + 0.5) * intensity * pulse;
            
            gl_FragColor = vec4(glowColor, fresnel * intensity);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      });
      
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      this.mesh.add(glowMesh);
      this.glowMesh = glowMesh;
      
      // Add corona effect (larger outer glow) - enhanced for bloom
      const coronaGeometry = new THREE.SphereGeometry(radius * 4, 32, 16);
      const coronaMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0.0 },
          color: { value: new THREE.Color(this.color).multiplyScalar(1.2) } // Brighter color
        },
        vertexShader: `
          varying vec3 vNormal;
          
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          uniform vec3 color;
          varying vec3 vNormal;
          
          void main() {
            float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 4.0);
            float pulse = 0.9 + 0.1 * sin(time + length(vNormal) * 10.0);
            
            // Increased color intensity for bloom
            vec3 finalColor = color * fresnel * pulse * 0.4;
            float alpha = fresnel * 0.5;
            
            gl_FragColor = vec4(finalColor, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      });
      
      const coronaMesh = new THREE.Mesh(coronaGeometry, coronaMaterial);
      this.mesh.add(coronaMesh);
      this.coronaMesh = coronaMesh;
      
      // Set random rotation for twinkling effect
      this.rotationSpeed = (Math.random() - 0.5) * 0.002; // Slow rotation
      this.pulseSpeed = 0.5 + Math.random() * 1.0; // For pulsing effect
      this.pulseAmount = 0.15 + Math.random() * 0.15; // Pulse intensity
      this.pulseClock = Math.random() * Math.PI * 2; // Random start phase
      
    } else if (this.type === OBJECT_TYPES.PLANET) {
      // For planets, use a 3D sphere with physically-based material and fresnel effect
      geometry = new THREE.SphereGeometry(radius, 32, 32);
      
      // Convert THREE.Color to components for shader
      const r = this.color.r;
      const g = this.color.g;
      const b = this.color.b;
      
      // Create a shader material with fresnel effect for planets
      material = new THREE.ShaderMaterial({
        uniforms: {
          baseColor: { value: new THREE.Color(this.color) },
          time: { value: 0 },
          resolution: { value: new THREE.Vector2(1024, 1024) }
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vPosition;
          
          void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 baseColor;
          uniform float time;
          uniform vec2 resolution;
          
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vPosition;
          
          // Noise function for planet texturing
          float hash(float n) { return fract(sin(n) * 43758.5453123); }
          
          float noise(vec2 p) {
            vec2 ip = floor(p);
            vec2 fp = fract(p);
            fp = fp * fp * (3.0 - 2.0 * fp);
            
            float n = ip.x + ip.y * 57.0;
            
            return mix(
              mix(hash(n), hash(n + 1.0), fp.x),
              mix(hash(n + 57.0), hash(n + 58.0), fp.x),
              fp.y
            );
          }
          
          // Fractal Brownian Motion for terrain generation
          float fbm(vec2 p) {
            float f = 0.0;
            float amp = 0.5;
            
            for(int i = 0; i < 5; i++) {
              f += amp * noise(p);
              p *= 2.0;
              amp *= 0.5;
            }
            
            return f;
          }
          
          void main() {
            // Calculate fresnel effect (rim lighting)
            float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
            
            // Generate planet surface details using noise
            float noiseValue = fbm(vUv * 10.0 + time * 0.05);
            
            // Create terrain using the base color
            vec3 terrainColor = baseColor * (0.7 + 0.3 * noiseValue);
            
            // Add darker areas (oceans/shadows)
            terrainColor = mix(terrainColor, terrainColor * 0.3, smoothstep(0.4, 0.5, noiseValue));
            
            // Add highlight areas (mountains/clouds)
            terrainColor = mix(terrainColor, vec3(1.0), smoothstep(0.7, 0.8, noiseValue) * 0.3);
            
            // Add atmospheric glow at the edges using fresnel
            vec3 atmosphereColor = baseColor * 1.2 + vec3(0.2);
            vec3 finalColor = mix(terrainColor, atmosphereColor, fresnel * 0.6);
            
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `,
        side: THREE.FrontSide,
        transparent: false,
        depthWrite: true
      });
      
    } else { // DEBRIS
      geometry = new THREE.SphereGeometry(radius, 16, 8);
      
      // Use a more interesting material for debris with some shininess
      material = new THREE.MeshStandardMaterial({
        color: this.color,
        roughness: 0.7,
        metalness: 0.3,
        emissive: new THREE.Color(this.color).multiplyScalar(0.2),
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
  
  // New method for orbital movement
  updateOrbit(deltaTime) {
    if (!this.parent) return;
    
    // Update orbital position around parent
    this.orbitalPhase += this.orbitalSpeed * deltaTime;
    
    // Calculate new position based on orbit
    const x = this.parent.position.x + Math.cos(this.orbitalPhase) * this.orbitalRadius;
    const y = this.parent.position.y + Math.sin(this.orbitalPhase) * this.orbitalRadius;
    
    // Add inclination effect for 3D-like orbits
    const z = Math.sin(this.orbitalPhase) * this.orbitalRadius * this.orbitalInclination;
    
    // Update position
    this.position.set(x, y, z);
    this.mesh.position.copy(this.position);
  }
  
  update(deltaTime, blackHole, allObjects) {
    if (this.isAbsorbed) return;
    
    // Planets are influenced by nearby stars (new feature)
    if (this.type === OBJECT_TYPES.PLANET && allObjects) {
      // Look for nearby stars that can influence this planet
      for (const obj of allObjects) {
        if (obj !== this && obj.type === OBJECT_TYPES.STAR && !obj.isAbsorbed) {
          const distance = this.position.distanceTo(obj.position);
          
          // Only apply influence within a reasonable range (scale with star mass)
          const influenceRadius = obj.mass * 8;
          
          if (distance < influenceRadius) {
            // Calculate gravitational pull from the star
            // Direction to the star
            const dirToStar = new THREE.Vector3().subVectors(obj.position, this.position).normalize();
            
            // Force is proportional to star's mass and inversely proportional to distance squared
            // Using a smaller gravitational constant for better gameplay
            const starGravityConstant = 0.015;
            const forceMagnitude = starGravityConstant * obj.mass / (distance * distance);
            
            // Apply force as acceleration (F=ma, a=F/m)
            const starAcceleration = dirToStar.multiplyScalar(forceMagnitude);
            
            // Add star's gravity to planet's velocity
            this.velocity.add(starAcceleration.multiplyScalar(deltaTime));
            
            // Add slight perpendicular component for orbital motion if very close to the star
            if (distance < influenceRadius * 0.5) {
              const perpDirection = new THREE.Vector3(-dirToStar.y, dirToStar.x, 0).normalize();
              this.velocity.add(perpDirection.multiplyScalar(forceMagnitude * 0.5 * deltaTime));
            }
          }
        }
      }
    }
    
    if (blackHole) {
      // Calculate gravitational force
      const force = blackHole.getGravitationalPull(this.position, this.mass);
      
      // Apply force to velocity (F = ma, so a = F/m)
      const acceleration = force.divideScalar(this.mass);
      
      // For planets orbiting a star, scale down velocity changes
      // This helps maintain orbits until closer to the black hole
      if (this.parent && this.parent.type === OBJECT_TYPES.STAR) {
        // Scale based on distance to black hole vs orbital radius
        const distToBlackHole = this.position.distanceTo(blackHole.position);
        const stabilityFactor = Math.min(1, (this.orbitalRadius * 2) / distToBlackHole);
        
        // Apply stability - farther from black hole = more stable orbits
        this.velocity.multiplyScalar(0.7 + 0.3 * stabilityFactor);
      }
      
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
    this.mesh.position.z = this.position.z; // Make sure to update z position
    
    // Add vertical oscillation based on type and time
    // We'll make this much more subtle since we're now using actual z-position
    if (!this.isAbsorbed) {
      const time = performance.now() * 0.001;
      let zOffset = 0;
      
      if (this.type === OBJECT_TYPES.STAR) {
        // Very subtle oscillation for stars
        zOffset = Math.sin(time * this._oscSpeed + this._oscPhase) * this._oscAmplitude * 0.5;
      } else {
        // Slightly more pronounced oscillation for planets and debris 
        zOffset = Math.sin(time * this._oscSpeed + this._oscPhase) * this._oscAmplitude * 0.8;
        
        // Add some randomness to planet orbits in z-axis
        if (Math.random() < 0.005) { // Occasional slight z-velocity changes
          this._oscAmplitude = Math.max(0.1, Math.min(0.8, this._oscAmplitude + (Math.random() - 0.5) * 0.1));
        }
      }
      
      // Add the oscillation to the actual z-position
      this.mesh.position.z += zOffset;
    }
    
    // Apply rotation
    if (this.mesh) {
      this.mesh.rotation.y += this.rotationSpeed;
      
      // Update time uniforms for shader animations
      if (this.mesh.material && this.mesh.material.uniforms && this.mesh.material.uniforms.time) {
        this.mesh.material.uniforms.time.value += deltaTime;
      }
      
      // For stars, update the shader time uniform in all components
      if (this.type === OBJECT_TYPES.STAR) {
        // Update all star planes' uniforms
        if (this.starPlanes) {
          this.starPlanes.forEach(plane => {
            if (plane.material && plane.material.uniforms && plane.material.uniforms.time) {
              plane.material.uniforms.time.value += deltaTime;
            }
          });
        }
        
        // Update glow and corona mesh uniforms
        if (this.glowMesh && this.glowMesh.material && this.glowMesh.material.uniforms) {
          this.glowMesh.material.uniforms.time.value += deltaTime;
        }
        
        if (this.coronaMesh && this.coronaMesh.material && this.coronaMesh.material.uniforms) {
          this.coronaMesh.material.uniforms.time.value += deltaTime;
        }
        
        // Update pulse clock
        this.pulseClock += deltaTime * this.pulseSpeed;
        
        // Calculate pulse factor (0.8 to 1.2 range)
        const pulseFactor = 1 + Math.sin(this.pulseClock) * this.pulseAmount;
        
        // Apply subtle pulsing to the planes to create dynamic effect
        if (this.starPlanes) {
          this.starPlanes.forEach(plane => {
            if (!plane.userData.originalScale) {
              plane.userData.originalScale = plane.scale.clone();
            }
            
            // Different pulsing for each plane for more natural effect
            const individualPulse = pulseFactor * (0.95 + 0.1 * Math.random());
            plane.scale.copy(plane.userData.originalScale).multiplyScalar(individualPulse);
          });
        }
        
        // Subtly rotate the star planes for a more dynamic look
        if (this.starPlanes && this.starPlanes.length > 0) {
          // Different rotation speeds for different planes
          this.starPlanes[0].rotation.z += deltaTime * 0.05;
          if (this.starPlanes.length > 1) this.starPlanes[1].rotation.z -= deltaTime * 0.03;
          if (this.starPlanes.length > 2) this.starPlanes[2].rotation.x += deltaTime * 0.04;
          if (this.starPlanes.length > 3) this.starPlanes[3].rotation.x -= deltaTime * 0.02;
        }
      }
    }
    
    // Update any children objects if needed
    if (this.children.length > 0) {
      this.children.forEach(child => {
        child.updateOrbit(deltaTime);
      });
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
  
  // Create a texture for star rays
  createStarRayTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Create gradient from center
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    
    // Fill background
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 128, 128);
    
    // Draw main ray along x-axis
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 56, 128, 16);
    
    // Add horizontal lens flare effect
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(64, 64, 8, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
  
  // Create a texture for the star points (4-pointed star)
  createStarPointsTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Center of canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw star points
    const drawStarRay = (angle, length, width) => {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      
      // Create gradient for the ray
      const gradient = ctx.createLinearGradient(0, 0, length, 0);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.7)');
      gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
      gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
      gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient;
      
      // Draw the ray as a long rectangle
      ctx.beginPath();
      ctx.moveTo(0, -width / 2);
      ctx.lineTo(length, -width / 4);
      ctx.lineTo(length, width / 4);
      ctx.lineTo(0, width / 2);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    };
    
    // Draw 4 main rays
    const rayLength = canvas.width * 0.5;
    const rayWidth = canvas.width * 0.12;
    
    drawStarRay(0, rayLength, rayWidth); // Right
    drawStarRay(Math.PI / 2, rayLength, rayWidth); // Up
    drawStarRay(Math.PI, rayLength, rayWidth); // Left
    drawStarRay(3 * Math.PI / 2, rayLength, rayWidth); // Down
    
    // Draw 4 diagonal rays (thinner)
    const diagonalRayLength = canvas.width * 0.35;
    const diagonalRayWidth = canvas.width * 0.05;
    
    drawStarRay(Math.PI / 4, diagonalRayLength, diagonalRayWidth); // Up-Right
    drawStarRay(3 * Math.PI / 4, diagonalRayLength, diagonalRayWidth); // Up-Left
    drawStarRay(5 * Math.PI / 4, diagonalRayLength, diagonalRayWidth); // Down-Left
    drawStarRay(7 * Math.PI / 4, diagonalRayLength, diagonalRayWidth); // Down-Right
    
    // Draw center glow
    const glowRadius = canvas.width * 0.1;
    const glowGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, glowRadius
    );
    
    glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    glowGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
    glowGradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
  
  // Create a texture for the star center
  createStarCenterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Center of canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Create bright center with radial gradient
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, canvas.width / 2
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, canvas.width / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
  
  // Create a texture for lens flares
  createFlareTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Center of canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Create flare with radial gradient
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, canvas.width / 2
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, canvas.width / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
  
  // Create a star shader material to give stars a spiky, glowing appearance
  createStarShaderMaterial(radius) {
    // Get normalized color components
    const r = this.color.r;
    const g = this.color.g;
    const b = this.color.b;
    
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        radius: { value: radius },
        starColor: { value: new THREE.Vector3(r, g, b) },
        resolution: { value: new THREE.Vector2(window.innerWidth || 1024, window.innerHeight || 1024) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float radius;
        uniform vec3 starColor;
        uniform vec2 resolution;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        // Random function for twinkling
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }
        
        // Improved noise function
        float noise(vec2 st) {
          vec2 i = floor(st);
          vec2 f = fract(st);
          
          // Cubic interpolation
          vec2 u = f * f * (3.0 - 2.0 * f);
          
          // Four corners
          float a = random(i);
          float b = random(i + vec2(1.0, 0.0));
          float c = random(i + vec2(0.0, 1.0));
          float d = random(i + vec2(1.0, 1.0));
          
          // Mix 4 corners
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        
        // Star ray function - optimized for sharper rays
        float starRay(vec2 uv, float numPoints, float sharpness) {
          vec2 centered = uv * 2.0 - 1.0;
          float angle = atan(centered.y, centered.x);
          float len = length(centered);
          
          // Make sharper peaks at each point of the star
          float starShape = abs(mod(angle + time * 0.1, 3.14159 / numPoints) - 3.14159 / (numPoints * 2.0));
          starShape = pow(starShape, sharpness);
          
          // Distance falloff
          float falloff = smoothstep(1.0, 0.0, len);
          
          return starShape * falloff;
        }
                
        void main() {
          vec2 uv = vUv;
          vec2 centered = uv * 2.0 - 1.0;
          float dist = length(centered);
          
          // Base bright center (intensified for bloom)
          float core = smoothstep(0.6, 0.0, dist);
          // Make the core extra bright to trigger bloom
          core = pow(core, 0.5) * 1.5;
          
          // Create rays with different frequencies
          float ray1 = starRay(uv, 4.0, 3.0) * 0.8; // 4-point star, increased intensity
          float ray2 = starRay(uv, 8.0, 5.0) * 0.5; // 8-point details, increased intensity
          
          // Dynamic twinkling
          float twinkle = noise(centered * 4.0 + time * 0.5);
          twinkle = 0.8 + 0.2 * twinkle;
          
          // Combine for final star shape - amplify brightness for bloom trigger
          float star = core + ray1 + ray2;
          star *= twinkle;
          
          // Add bloom/glow
          float glow = smoothstep(1.0, 0.0, dist);
          glow = pow(glow, 1.3) * 1.2; // Intensified glow
          
          // Final color - make it brighter to work well with bloom
          vec3 finalColor = mix(starColor * 1.3, vec3(1.0), core * 0.8);
          finalColor = mix(finalColor, starColor * 1.2, (1.0 - glow) * 0.7);
          
          // Apply brightness - intensify to trigger bloom nicely
          finalColor *= (star + glow * 0.6) * 1.3;
          
          // Add subtle color variation and extra brightness for the hot center
          finalColor += vec3(0.1, 0.05, 0.0) * smoothstep(0.5, 0.0, dist) * (0.5 + 0.5 * sin(time));
          
          // Make core extra bright - this will make bloom effect pop
          if (dist < 0.15) {
              finalColor = mix(finalColor, vec3(1.5, 1.5, 1.5), (1.0 - dist * 6.0) * 0.8);
          }
          
          // Transparency based on star intensity, never fully transparent at center
          float alpha = min(1.0, star + glow * 0.5);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }
} 