import { THREE } from '../libs/three-setup.js';
import { vertexShader, fragmentShader, accretionDiskVertexShader, accretionDiskFragmentShader, distortionFieldFragmentShader } from '../shaders/blackHoleShaders.js';

export class BlackHole {
  constructor(options = {}) {
    this.mass = options.initialMass || 1; // In solar mass units
    this.position = new THREE.Vector3(0, 0, 0);
    this.gravitationalConstant = 0.25; // Increased for stronger pull (was 0.1)
    this.absorbThreshold = 2.0; // Significantly increased for better gameplay
    this.eventHorizonVisuals = options.eventHorizonVisuals !== undefined ? options.eventHorizonVisuals : true;
    this.gravitationalLensingEffect = options.gravitationalLensingEffect || 0.5;
    this.camera = options.camera || null; // Store camera reference for screen position calculation
    
    this.createMesh();
  }
  
  createMesh() {
    const geometry = new THREE.SphereGeometry(this.getRadius(), 32, 32);
    
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
          // Calculate normalized position from center
          vec3 nPos = normalize(vPosition);
          vec3 nNormal = normalize(vNormal);
          
          // Calculate rim lighting effect
          float rimLight = pow(1.0 - abs(dot(nNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          
          // Pure black color with rim effect
          vec3 color = vec3(0.0, 0.0, 0.0);
          
          // Add subtle deep blue glow at the edges
          color += vec3(0.0, 0.0, 0.1) * rimLight;
          
          gl_FragColor = vec4(color, 1.0); // Completely opaque black hole
        }
      `,
      side: THREE.FrontSide,
      transparent: false, // Keep it opaque, we'll rely on proper depth testing
      depthWrite: true,   // Enable depth writing
      depthTest: true     // Enable depth testing
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    
    // CRITICAL: Removed negative render order to allow proper depth testing
    // The black hole should now naturally render based on its z-position
    // Objects in front of it will render in front, objects behind it will render behind
    
    // Create an event horizon layer as a separate mesh with a slightly larger radius
    const eventHorizonGeometry = new THREE.SphereGeometry(this.getRadius() * 1.05, 32, 32);
    const eventHorizonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        radius: { value: this.getRadius() * 1.05 }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      opacity: 0.8,
      depthWrite: false, // Critical: Don't write to depth buffer for outer glow
      depthTest: true,   // But still test against it
      side: THREE.BackSide // Render inside of sphere
    });
    
    this.eventHorizon = new THREE.Mesh(eventHorizonGeometry, eventHorizonMaterial);
    this.eventHorizon.position.copy(this.position);
    
    // Create a group to hold the black hole and its event horizon
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.group.add(this.eventHorizon);
    
    // Add to parent object or scene
    if (this.parent) {
      this.parent.add(this.group);
    } else if (this.scene) {
      this.scene.add(this.group);
    }
    
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
    return Math.pow(this.mass, 1/3) * 0.6;
  }
  
  getGravitationalPull(objectPosition, objectMass) {
    // Calculate gravitational force between black hole and object
    const direction = new THREE.Vector3().subVectors(this.position, objectPosition);
    const distance = direction.length();
    
    // Prevent division by zero or very small numbers
    if (distance < 0.1) {
      return new THREE.Vector3(0, 0, 0);
    }
    
    // Calculate x,y alignment factor (how well the black hole is aligned with the object)
    // This is the key gameplay mechanic - alignment increases gravitational pull
    const xyDistance = Math.sqrt(
      Math.pow(this.position.x - objectPosition.x, 2) +
      Math.pow(this.position.y - objectPosition.y, 2)
    );
    const zDistance = Math.abs(this.position.z - objectPosition.z);
    
    // Calculate alignment factor - higher when xy-distance is small compared to z-distance
    // Using a much wider detection radius - similar to the visual indicator in main.js
    const maxAlignmentDistance = 15; // Significantly increased to match the wider detection in main.js
    let alignmentFactor = 1.0; // Default/minimum factor
    
    if (xyDistance < maxAlignmentDistance) {
      // Calculate alignment precision - 1.0 is perfect alignment, 0.0 is no alignment
      const alignmentPrecision = 1.0 - (xyDistance / maxAlignmentDistance);
      
      // Exponential curve for stronger effect at better alignment
      // Significantly increased multiplier (from 3.0 to 5.0) for stronger gravitational effect
      const alignmentBoost = Math.pow(alignmentPrecision, 2) * 100.0; // Up to 5x stronger pull when perfectly aligned
      alignmentFactor = 1.0 + alignmentBoost;
      
      // Debug log when strong alignment is detected
      if (alignmentFactor > 3.0) {
        console.log(`Very strong alignment (${alignmentFactor.toFixed(2)}x) with object at xy-distance: ${xyDistance.toFixed(2)}`);
      }
    }
    
    // Calculate force magnitude using modified gravitational formula
    let forceMagnitude;
    
    // Event horizon-like effect: extreme pull when very close
    const eventHorizonRadius = this.getRadius() * 5;
    if (distance < eventHorizonRadius) {
      // Exponential increase in force as objects get very close
      // This creates a "point of no return" effect
      const proximityFactor = 1.0 - Math.pow(distance / eventHorizonRadius, 2);
      forceMagnitude = this.gravitationalConstant * this.mass * objectMass * (2.0 + 8.0 * proximityFactor) / (distance * distance);
      
      // Apply alignment factor here too for consistent behavior
      forceMagnitude *= alignmentFactor;
    } else {
      // Normal gravitational force for further objects
      // F = G * (m1 * m2) / r^2 with distance-based blending to linear falloff
      const invSquare = this.gravitationalConstant * this.mass * objectMass / (distance * distance);
      const invLinear = this.gravitationalConstant * this.mass * objectMass / distance;
      let t = (distance - 30) / 20;
      t = Math.max(0, Math.min(1, t));
      forceMagnitude = (1 - t) * invSquare + t * invLinear;
      
      // Apply alignment factor to normal gravitational force
      forceMagnitude *= alignmentFactor;
    }
    
    // Ensure minimum force magnitude that scales with object mass
    const minForceMagnitude = 0.01 * objectMass;
    if (forceMagnitude < minForceMagnitude) {
      forceMagnitude = minForceMagnitude;
    }
    
    // Normalize direction to get correct 3D direction
    const normalizedDirection = direction.clone().normalize();
    
    // Calculate z-component force factor
    // This enhances the z-axis pull to make depth movement more visible
    let zForceFactor = 1.0;
    
    // Enhance z-force based on alignment - key gameplay aspect
    // When aligned, we want to rapidly pull the object along the z-axis
    if (xyDistance < maxAlignmentDistance) {
      // Stronger z-force when aligned, scales with alignment precision
      const alignmentPrecision = 1.0 - (xyDistance / maxAlignmentDistance);
      
      // Significantly increased z-force multiplier (from 3.0 to 6.0) for more dramatic z-movement when aligned
      const zAlignmentBoost = 1.0 + Math.pow(alignmentPrecision, 2) * 6.0; // Up to 7x z-force when perfectly aligned
      
      zForceFactor = Math.max(zForceFactor, zAlignmentBoost);
    } 
    // Also keep the previous z-force enhancement for objects at different depths
    else if (xyDistance < this.getRadius() * 3 && zDistance > 5) {
      // Object is aligned with black hole in x-y plane but at different z-depth
      // Enhance z-force to create more visible depth movement
      zForceFactor = 2.0 + Math.min(zDistance / 30, 2.0);
    }
    
    // Create the final 3D force vector with enhanced z-component
    const force = new THREE.Vector3(
      normalizedDirection.x * forceMagnitude,
      normalizedDirection.y * forceMagnitude,
      normalizedDirection.z * forceMagnitude * zForceFactor
    );
    
    return force;
  }
  
  increaseMass(amount) {
    this.mass += amount;
    
    // Log the mass increase for debugging
    console.log(`Black hole mass increased by ${amount.toFixed(2)} to ${this.mass.toFixed(2)}`);
    
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
        this.eventHorizon.material.uniforms.radius.value = currentRadius * 1.05;
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
    
    // Significantly increased absorption radius for more aggressive capture
    const absorptionRadius = this.getRadius() * 6 + celestialObject.getRadius();
    
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
    
    // More lenient absorption check - if objects are close in x-y plane OR close in 3D space
    // Adjust max Z absorption range based on black hole size for better scaling
    const maxZAbsorption = this.getRadius() * 8; // Slightly reduced z-range for more realistic absorption
    
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
      for (const object of celestialObjects) {
        if (!object.isAbsorbed && !object.isBeingAbsorbed) {
          this.checkAbsorption(object);
        }
      }
    }
  }
  
  // Get screen position for lens effect
  getScreenPosition(camera) {
    // Use the provided camera or the stored camera reference
    const cam = camera || this.camera;
    if (!cam) return { x: window.innerWidth/2, y: window.innerHeight/2 };
    
    // Project the black hole's position to screen space
    const vector = new THREE.Vector3();
    vector.copy(this.position);
    
    // Project to normalized device coordinates
    vector.project(cam);
    
    // Convert from NDC (-1 to 1) to screen coordinates
    const screenPosition = {
      x: (vector.x + 1) * window.innerWidth / 2,
      y: (-vector.y + 1) * window.innerHeight / 2  // Y is flipped in WebGL
    };
    
    return screenPosition;
  }
  
  // Get properties needed for post-processing lens effect
  getLensEffectProperties() {
    return {
      position: this.position.clone(),      // 3D world position
      radius: this.getRadius(),             // Current radius in world units
      mass: this.mass                       // Current mass value
    };
  }
} 