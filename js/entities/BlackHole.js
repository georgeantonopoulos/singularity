import { THREE } from '../libs/three-setup.js';
import { vertexShader, fragmentShader, accretionDiskVertexShader, accretionDiskFragmentShader, distortionFieldFragmentShader } from '../shaders/blackHoleShaders.js';

export class BlackHole {
  constructor(options = {}) {
    this.mass = options.initialMass || 1; // In solar mass units
    this.position = new THREE.Vector3(0, 0, -120); // Position the black hole much deeper in 3D space
    this.gravitationalConstant = 0.25; // Increased for stronger pull (was 0.1)
    this.absorbThreshold = 2.0; // Significantly increased for better gameplay
    this.eventHorizonVisuals = options.eventHorizonVisuals !== undefined ? options.eventHorizonVisuals : true;
    this.gravitationalLensingEffect = options.gravitationalLensingEffect || 0.5;
    this.camera = options.camera || null; // Store camera reference for screen position calculation
    
    this.createMesh();
  }
  
  createMesh() {
    const baseRadius = this.getRadius() * 3.5;
    const geometry = new THREE.SphereGeometry(baseRadius, 32, 32);
    
    // Update the material to ensure glow is at exact perimeter
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        radius: { value: this.getRadius() },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        intensity: { value: 0.7 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float radius;
        uniform vec2 resolution;
        uniform float intensity;
        
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          vec3 nPos = normalize(vPosition);
          vec3 nNormal = normalize(vNormal);
          
          // Sharper rim lighting with exact perimeter glow
          float rimLight = pow(1.0 - abs(dot(nNormal, vec3(0.0, 0.0, 1.0))), 8.0);
          
          vec3 color = vec3(0.0);
          
          // Add blue glow exactly at perimeter
          float edgeGlow = smoothstep(0.5, 1.0, rimLight);
          color += vec3(0.0, 0.0, 0.3) * edgeGlow;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.FrontSide,
      transparent: false,
      depthWrite: true,
      depthTest: true
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    
    this.mesh.position.set(0, 0, 0);
    this.group.add(this.mesh);
    
    // Create event horizon with enhanced glow
    const eventHorizonGeometry = new THREE.SphereGeometry(this.getRadius() * 1.3, 32, 32);
    const eventHorizonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        radius: { value: this.getRadius() * 1.3 }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide
    });
    
    this.eventHorizon = new THREE.Mesh(eventHorizonGeometry, eventHorizonMaterial);
    this.eventHorizon.position.set(0, 0, 0);
    this.group.add(this.eventHorizon);
    
    return this.group;
  }
  
  createAccretionDisk() {
    const diskGeometry = new THREE.TorusGeometry(2.1 * this.getRadius(), 0.9 * this.getRadius(), 64, 8);
    
    // Use our custom shader for the accretion disk
    const diskMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        mass: { value: this.mass }
      },
      vertexShader: accretionDiskVertexShader,
      fragmentShader: accretionDiskFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    this.accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
  }
  
  createDistortionField() {
    // This is now empty as the distortion effect will be 
    // handled by post-processing instead of a 3D mesh
  }
  
  getRadius() {
    // Black hole radius scales with mass (simplified for gameplay)
    // Increase base size to ensure visibility
    return Math.pow(this.mass, 1/3) * 3.0; // Much larger base size
  }
  
  getGravitationalPull(objectPosition, objectMass, celestialObject) {
    const direction = new THREE.Vector3().subVectors(this.position, objectPosition);
    const distance = direction.length();
    
    if (distance < 0.1) return new THREE.Vector3(0, 0, 0);
    
    // Calculate XY distance (projected distance in XY plane)
    const xyDistance = Math.sqrt(
      Math.pow(this.position.x - objectPosition.x, 2) +
      Math.pow(this.position.y - objectPosition.y, 2)
    );
    
    // Calculate Z distance separately
    const zDistance = Math.abs(this.position.z - objectPosition.z);
    
    // Get the black hole's visual perimeter radius (where the blue glow is)
    const perimeterRadius = this.getRadius() * 3.5;
    
    // Calculate how close the object is to the perimeter in XY plane
    const distanceFromPerimeter = Math.abs(xyDistance - perimeterRadius);
    const perimeterAlignmentThreshold = perimeterRadius * 0.3; // 30% of perimeter radius
    
    // Calculate perimeter alignment factor (1.0 = perfect alignment, 0.0 = no alignment)
    let perimeterAlignmentFactor = 0.0;

    // Check if object has an active trajectory line
    const hasTrajectory = celestialObject && celestialObject.trajectoryLine;
    
    if (hasTrajectory || distanceFromPerimeter < perimeterAlignmentThreshold) {
      // Apply boost for either trajectory or close perimeter alignment
      perimeterAlignmentFactor = Math.pow(
        1.0 - (distanceFromPerimeter / perimeterAlignmentThreshold),
        2.0
      ) * 500.0; // Massive boost when aligned with perimeter or has trajectory
      
      // Extra boost when trajectory is active
      if (hasTrajectory) {
        perimeterAlignmentFactor *= 1.5; // 50% stronger when trajectory is shown
      }
    }
    
    // Enhanced Z-axis detection radius - much larger than before
    const maxAlignmentDistance = 15 * Math.pow(this.mass, 0.33);
    const maxZAlignmentDistance = maxAlignmentDistance * 5; // Increased Z detection range
    
    // Calculate Z-axis alignment with higher base force
    const zAlignmentFactor = zDistance < maxZAlignmentDistance ? 
      Math.pow(1.0 - (zDistance / maxZAlignmentDistance), 2) * 8.0 : 1.0;
    
    // Combine alignment factors - perimeter alignment now dominates
    let alignmentFactor = 1.0 + perimeterAlignmentFactor;
    
    // Calculate force magnitude with enhanced perimeter effect
    const eventHorizonRadius = this.getRadius() * 5 * Math.pow(this.mass, 0.33);
    let forceMagnitude;
    
    if (distance < eventHorizonRadius) {
      const proximityFactor = 1.0 - Math.pow(distance / eventHorizonRadius, 2);
      forceMagnitude = this.gravitationalConstant * this.mass * objectMass * 
                       (2.0 + 8.0 * proximityFactor) / (distance * distance);
    } else {
      const invSquare = this.gravitationalConstant * this.mass * objectMass / (distance * distance);
      const invLinear = this.gravitationalConstant * this.mass * objectMass / distance;
      let t = (distance - 30) / 20;
      t = Math.max(0, Math.min(1, t));
      forceMagnitude = (1 - t) * invSquare + t * invLinear;
    }
    
    // Apply combined alignment factors
    forceMagnitude *= (alignmentFactor * Math.max(1.0, zAlignmentFactor));
    
    // Ensure minimum force
    const minForceMagnitude = 0.01 * objectMass;
    forceMagnitude = Math.max(forceMagnitude, minForceMagnitude);
    
    const normalizedDirection = direction.clone().normalize();
    
    // Enhanced Z-force calculation with perimeter consideration
    let zForceFactor = Math.max(2.0, zAlignmentFactor * 4.0);
    if (perimeterAlignmentFactor > 0) {
      zForceFactor *= (1.0 + perimeterAlignmentFactor * 0.5); // Boost Z-force when near perimeter
    }
    
    // Create final force vector with enhanced Z-component
    const force = new THREE.Vector3(
      normalizedDirection.x * forceMagnitude,
      normalizedDirection.y * forceMagnitude,
      normalizedDirection.z * forceMagnitude * zForceFactor
    );
    
    return force;
  }
  
  increaseMass(amount) {
    // Increase mass gain for more noticeable growth
    const growthFactor = 0.5; // Increased from 0.025
    this.mass += amount * growthFactor;
    
    // Log the mass increase for debugging
    console.log(`Black hole mass increased by ${(amount * growthFactor).toFixed(2)} to ${this.mass.toFixed(2)}`);
    
    // Update shader uniforms for all children
    if (this.mesh && this.mesh.material && this.mesh.material.uniforms) {
      this.mesh.material.uniforms.radius.value = this.getRadius();
      this.mesh.material.uniforms.intensity.value = Math.min(0.7 + (this.mass * 0.01), 1.0);
    }
    
    this.updateVisuals();
  }
  
  updateVisuals() {
    if (!this.mesh) return;
    
    const currentRadius = this.getRadius();
    
    // Update size of both core and event horizon
    this.mesh.scale.set(1, 1, 1);
    
    // Update event horizon size if it exists
    if (this.eventHorizon) {
      this.eventHorizon.scale.set(1, 1, 1);
      
      // Update event horizon uniforms
      if (this.eventHorizon.material && this.eventHorizon.material.uniforms) {
        this.eventHorizon.material.uniforms.radius.value = currentRadius * 1.3;
      }
    }
    
    // Update shader uniforms for core
    if (this.mesh.material && this.mesh.material.uniforms) {
      this.mesh.material.uniforms.radius.value = currentRadius;
      this.mesh.material.uniforms.intensity.value = Math.min(0.7 + (this.mass * 0.01), 1.0);
    }
  }
  
  // Update shader time uniforms for animations
  updateShaderTimeUniforms(deltaTime) {
    // Update core mesh shader time
    if (this.mesh && this.mesh.material && this.mesh.material.uniforms) {
      this.mesh.material.uniforms.time.value += deltaTime;
    }
    
    // Update event horizon shader time
    if (this.eventHorizon && this.eventHorizon.material && this.eventHorizon.material.uniforms) {
      this.eventHorizon.material.uniforms.time.value += deltaTime;
    }
  }
  
  canAbsorb(celestialObject) {
    // Check if the black hole can absorb this object based on mass
    return this.mass > celestialObject.mass;
  }
  
  checkAbsorption(celestialObject) {
    if (celestialObject.isAbsorbed) return false;
    
    // Calculate 3D distance between black hole and object
    const distance = this.position.distanceTo(celestialObject.position);
    
    // Calculate projected 2D distance (x-y plane) for visual absorption
    const xyDistance = Math.sqrt(
      Math.pow(this.position.x - celestialObject.position.x, 2) +
      Math.pow(this.position.y - celestialObject.position.y, 2)
    );
    
    // Calculate z-distance (depth) between object and black hole
    const zDistance = Math.abs(this.position.z - celestialObject.position.z);
    
    // Scale absorption radius with black hole mass
    // Larger black holes can absorb objects from further away
    const massScaleFactor = Math.pow(this.mass, 0.4); // Higher exponent = more aggressive growth
    const absorptionRadius = this.getRadius() * 6 * massScaleFactor + celestialObject.getRadius();
    
    // Calculate z-factor to adjust absorption radius based on z-position
    // Objects further away in z-space should be harder to absorb
    const zFactor = Math.max(0.8, 1.0 - (zDistance / 50));
    
    // For objects behind the black hole (negative z), use a larger absorption radius
    // to compensate for perspective foreshortening
    let adjustedAbsorptionRadius = absorptionRadius * zFactor;
    if (celestialObject.position.z < this.position.z) {
      // Object is behind the black hole, increase absorption radius proportionally
      // but with a more gradual falloff based on z-distance
      adjustedAbsorptionRadius *= (1 + Math.min(zDistance/40, 0.8));
    }
    
    // Scale max Z absorption range based on black hole size for better scaling
    const maxZAbsorption = this.getRadius() * 8 * massScaleFactor; // Scales with black hole size
    
    // Check if object should be absorbed based on either x-y distance or full 3D distance
    // Use a weighted approach that considers both xy-distance and z-distance
    if ((xyDistance <= adjustedAbsorptionRadius && zDistance <= maxZAbsorption * 1.2) || 
        distance <= absorptionRadius * 1.3) {
      // For objects not aligned in xy-plane, use more relaxed z-distance check
      if (zDistance <= maxZAbsorption) {
        console.log(`Object absorption started! Type: ${celestialObject.type}, Mass: ${celestialObject.mass.toFixed(2)}, Distance: ${distance.toFixed(2)}, Z-distance: ${zDistance.toFixed(2)}`);
        
        // Start absorption animation instead of immediately absorbing
        this.animateObjectAbsorption(celestialObject, distance);
        
        return true;
      }
    }
    
    return false;
  }
  
  animateObjectAbsorption(object, distance) {
    // Don't re-absorb objects
    if (object.isBeingAbsorbed || object.isAbsorbed) return;
    
    // Mark object as being absorbed
    object.isBeingAbsorbed = true;
    
    // Set start position at current position
    const startPos = object.position.clone();
    
    // Set a fixed duration
    const duration = 1.0;
    const startTime = Date.now();
    
    // The animation function
    const animate = () => {
      // Calculate progress (0 to 1)
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1.0);
      
      // Current black hole position
      const bhPos = this.position;
      
      // Linear movement directly toward black hole
      const x = startPos.x + (bhPos.x - startPos.x) * progress;
      const y = startPos.y + (bhPos.y - startPos.y) * progress;
      const z = startPos.z + (bhPos.z - startPos.z) * progress;
      
      // Update position
      object.position.set(x, y, z);
      object.mesh.position.set(x, y, z);
      
      // Scale down linearly
      const scale = 1.0 - progress;
      object.mesh.scale.set(scale, scale, scale);
      
      // Finish at progress 1.0
      if (progress >= 1.0) {
        // Mark as absorbed
        object.isAbsorbed = true;
        
        // Set position to black hole
        object.position.copy(bhPos);
        object.mesh.position.copy(bhPos);
        object.mesh.scale.set(0, 0, 0);
        
        // Increase black hole mass
        let massFactor = 0.025;
        if (object.type === 'star') massFactor = 0.03;
        else if (object.type === 'debris') massFactor = 0.02;
        
        this.increaseMass(object.mass * massFactor);
        
        // Call callback
        if (this.onObjectAbsorbed) {
          this.onObjectAbsorbed(object);
        }
      } else {
        // Continue animation
        requestAnimationFrame(animate);
      }
    };
    
    // Start animation
    animate();
  }
  
  update(deltaTime, celestialObjects) {
    // Update shader time uniforms for animations
    this.updateShaderTimeUniforms(deltaTime);
    
    // Update the smooth growth animation
    this.updateVisuals();
    
    // Check for collisions and absorptions
    if (celestialObjects) {
      // Scale absorption check frequency with mass - larger black holes check more frequently
      const checkFrequency = Math.max(1, Math.floor(10 / Math.pow(this.mass, 0.5)));
      
      // Only check a subset of objects each frame to improve performance
      // As the black hole grows, it will check more objects per frame
      for (let i = 0; i < celestialObjects.length; i++) {
        const object = celestialObjects[i];
        // Check objects based on a rotating index and black hole mass
        if (i % checkFrequency === this.frameCount % checkFrequency) {
          if (!object.isAbsorbed && !object.isBeingAbsorbed) {
            this.checkAbsorption(object);
          }
        }
      }
    }
    
    // Update frame counter
    this.frameCount = (this.frameCount || 0) + 1;
  }
  
  // Enhanced getScreenPosition method that's more robust for lens effect
  getScreenPosition(camera) {
    // Use the provided camera or the stored camera reference
    const cam = camera || this.camera;
    if (!cam) return { x: window.innerWidth/2, y: window.innerHeight/2 };
    
    // Project the black hole's position to screen space
    const vector = new THREE.Vector3();
    vector.copy(this.position);
    
    // Project to normalized device coordinates
    vector.project(cam);
    
    // Handle out-of-frustum case to prevent errors
    if (Math.abs(vector.x) > 1 || Math.abs(vector.y) > 1 || Math.abs(vector.z) > 1) {
      // Black hole is outside camera frustum, provide safe fallback
      return { x: window.innerWidth/2, y: window.innerHeight/2 };
    }
    
    // Convert from NDC (-1 to 1) to screen coordinates
    const screenPosition = {
      x: (vector.x + 1) * window.innerWidth / 2,
      y: (-vector.y + 1) * window.innerHeight / 2  // Y is flipped in WebGL
    };
    
    // Add slight debug - can be removed in production
    // console.log("Black hole 3D->2D: pos:", this.position, "screen:", screenPosition);
    
    return screenPosition;
  }
  
  // Enhanced properties for lens effect with improved camera distance scaling
  getLensEffectProperties() {
    return {
      position: this.position.clone(),      // 3D world position
      radius: this.getRadius(),             // Current radius in world units
      mass: this.mass,                      // Current mass value
      // Add camera distance scale factor for better lens effect
      cameraDistance: this.camera ? this.camera.position.distanceTo(this.position) : 90
    };
  }
} 