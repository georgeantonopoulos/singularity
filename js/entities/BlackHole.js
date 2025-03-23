import { THREE } from '../libs/three-setup.js';
import { vertexShader, fragmentShader, accretionDiskVertexShader, accretionDiskFragmentShader, distortionFieldFragmentShader } from '../shaders/blackHoleShaders.js';

export class BlackHole {
  constructor(options = {}) {
    this.mass = options.initialMass || 1; // In solar mass units
    this.position = new THREE.Vector3(0, 0, 0);
    this.gravitationalConstant = 0.1; // Simplified for gameplay
    this.absorbThreshold = 2.0; // Significantly increased for better gameplay
    this.eventHorizonVisuals = options.eventHorizonVisuals !== undefined ? options.eventHorizonVisuals : true;
    this.gravitationalLensingEffect = options.gravitationalLensingEffect || 0.5;
    this.camera = options.camera || null; // Store camera reference for screen position calculation
    
    this.createMesh();
  }
  
  createMesh() {
    // Create a group to hold all black hole components
    this.mesh = new THREE.Group();
    
    // For 2D, we use a circle geometry for the event horizon with larger radius for feathering
    const geometry = new THREE.CircleGeometry(this.getRadius() * 1.5, 64);
    
    // Use a custom shader material for the black hole with proper feathered edges
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        mass: { value: this.mass },
        radius: { value: this.getRadius() },
        gravitationalLensingEffect: { value: this.gravitationalLensingEffect }
      },
      vertexShader: `
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float mass;
        uniform float radius;
        uniform float gravitationalLensingEffect;
        
        varying vec2 vUv;
        
        void main() {
          // Calculate distance from center (0-1)
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(vUv, center) * 2.0;
          
          // Create event horizon with soft feathered edge
          // Core black hole is black, but the edges are semi-transparent
          vec3 color = vec3(0.0);
          
          // Create a softer edge that can be affected by the lens effect
          // Inner core is solid, then feathers out gradually
          float coreRadius = 0.6; // Relative to overall radius
          float featherStart = coreRadius;
          float featherEnd = 1.0;
          
          // Alpha is 1.0 in the core, then fades out to the edge
          float alpha = 1.0;
          if (dist > featherStart) {
            alpha = 1.0 - smoothstep(featherStart, featherEnd, dist);
          }
          
          // Add subtle blue glow at the edge (blue-shifted light)
          float edgeGlow = smoothstep(featherStart, featherEnd * 0.8, dist) * (1.0 - smoothstep(featherEnd * 0.8, featherEnd, dist));
          vec3 glowColor = vec3(0.1, 0.2, 0.8); // Blue-shifted
          color = mix(color, glowColor, edgeGlow * 0.3);
          
          // Add time-based variation to the edge for a more dynamic appearance
          float timePulse = sin(time * 0.5 + dist * 8.0) * 0.05 + 0.95;
          alpha *= timePulse;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: true, // Important for proper transparency
      side: THREE.DoubleSide
    });
    
    this.eventHorizon = new THREE.Mesh(geometry, material);
    this.mesh.add(this.eventHorizon);
    
    // Create a visual distortion effect
    this.createDistortionField();
    this.mesh.add(this.distortionField);
  }
  
  createAccretionDisk() {
    const diskRadius = this.getRadius() * 3;
    const diskGeometry = new THREE.RingGeometry(
      this.getRadius() * 1.2, 
      diskRadius, 
      64, 
      8
    );
    
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
    // Visual distortion field (gravitational lensing effect)
    const distortionRadius = this.getRadius() * 6;
    const distortionGeometry = new THREE.CircleGeometry(distortionRadius, 64);
    
    // Use a custom shader material for the distortion effect
    const distortionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        mass: { value: this.mass },
        radius: { value: this.getRadius() },
        distortionStrength: { value: 0.2 + (this.mass - 1) * 0.05 } // Scale with mass
      },
      vertexShader: `
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float mass;
        uniform float radius;
        uniform float distortionStrength;
        
        varying vec2 vUv;
        
        float getSchwarzschildRadius(float mass) {
          return mass * 0.1; // Simplified for visual effect
        }
        
        void main() {
          // Distance from center, normalized
          vec2 center = vec2(0.5, 0.5);
          vec2 dir = vUv - center;
          float dist = length(dir) * 2.0;
          
          // Calculate gravitational lensing effect
          float schwarzschildRadius = getSchwarzschildRadius(mass);
          float lensingFactor = schwarzschildRadius / max(0.05, dist);
          
          // More physically accurate light bending visualization
          float photonSphereRegion = smoothstep(schwarzschildRadius, schwarzschildRadius * 3.0, dist);
          photonSphereRegion *= smoothstep(schwarzschildRadius * 4.0, schwarzschildRadius * 1.5, dist);
          
          // Visual distortion intensity - stronger close to event horizon
          float distortionIntensity = lensingFactor * distortionStrength * photonSphereRegion;
          
          // Einstein ring effect
          float einsteinRing = smoothstep(schwarzschildRadius * 1.4, schwarzschildRadius * 1.5, dist);
          einsteinRing *= smoothstep(schwarzschildRadius * 1.7, schwarzschildRadius * 1.6, dist);
          einsteinRing *= 1.5; // Enhance the effect
          
          // Add subtle pulsation and time variance
          float timePulse = sin(time * 0.5) * 0.05 + 0.95;
          float timeVarying = (sin(dist * 20.0 - time * 2.0) * 0.5 + 0.5) * 0.2;
          
          // Blue-shifted light visualization
          vec3 baseColor = vec3(0.1, 0.2, 0.6);
          
          // Combine all effects 
          vec3 color = baseColor * (distortionIntensity + einsteinRing + timeVarying) * timePulse;
          
          // Alpha is stronger near the event horizon and fades out at larger distances
          float alpha = (distortionIntensity + einsteinRing * 0.5) * 0.4;
          alpha *= smoothstep(1.0, 0.1, dist); // Fade out with distance
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    this.distortionField = new THREE.Mesh(distortionGeometry, distortionMaterial);
    this.distortionField.position.z = -0.01; // Keep the distortion field behind the event horizon
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
    
    // Calculate force magnitude using Newton's law of gravitation
    // F = G * (m1 * m2) / r^2
    // Modified to ensure distant objects still experience some pull
    let forceMagnitude;
    
    if (distance > 30) {
      // For distant objects, reduce the falloff from inverse square to inverse
      // This ensures distant objects don't get "stuck" due to too weak forces
      forceMagnitude = this.gravitationalConstant * this.mass * objectMass / distance;
    } else {
      // Normal inverse square law for closer objects
      forceMagnitude = this.gravitationalConstant * this.mass * objectMass / (distance * distance);
    }
    
    // Apply a minimum force to ensure motion
    const minForceMagnitude = 0.005 * objectMass;
    if (forceMagnitude < minForceMagnitude) {
      forceMagnitude = minForceMagnitude;
    }
    
    // Apply force in the direction of the black hole (normalize first)
    return direction.normalize().multiplyScalar(forceMagnitude);
  }
  
  increaseMass(amount) {
    this.mass += amount;
    
    // Log the mass increase for debugging
    console.log(`Black hole mass increased by ${amount.toFixed(2)} to ${this.mass.toFixed(2)}`);
    
    // Update shader uniforms for all children
    if (this.mesh && this.mesh.children) {
      // Update core black hole
      if (this.mesh.children[0] && this.mesh.children[0].material && this.mesh.children[0].material.uniforms) {
        this.mesh.children[0].material.uniforms.mass.value = this.mass;
      }
      
      // Update distortion field
      if (this.mesh.children[1] && this.mesh.children[1].material && this.mesh.children[1].material.uniforms) {
        this.mesh.children[1].material.uniforms.mass.value = this.mass;
        
        if (this.mesh.children[1].material.uniforms.distortionStrength) {
          this.mesh.children[1].material.uniforms.distortionStrength.value = 0.2 + (this.mass - 1) * 0.05; // Increase with mass
        }
      }
    }
    
    this.updateVisuals();
  }
  
  updateVisuals() {
    // Update black hole radius
    const newRadius = this.getRadius();
    
    // Update event horizon
    if (this.eventHorizon) {
      // Scale the black hole
      this.eventHorizon.scale.set(1, 1, 1);
      
      // Create new geometry with updated radius
      this.eventHorizon.geometry.dispose(); // Clean up the old geometry
      this.eventHorizon.geometry = new THREE.CircleGeometry(newRadius * 1.5, 64);
      
      // Update the shader uniforms
      if (this.eventHorizon.material.uniforms) {
        this.eventHorizon.material.uniforms.radius.value = newRadius;
      }
    }
    
    // Update the distortion field
    if (this.distortionField) {
      const distortionRadius = newRadius * 6;
      
      // Create new geometry for distortion field
      this.distortionField.geometry.dispose();
      this.distortionField.geometry = new THREE.CircleGeometry(distortionRadius, 64);
      
      // Update uniforms
      if (this.distortionField.material.uniforms) {
        this.distortionField.material.uniforms.radius.value = newRadius;
        this.distortionField.material.uniforms.distortionStrength.value = 0.2 + (this.mass - 1) * 0.05; // Increase with mass
      }
    }
    
    // Update shader time uniforms for animations
    this.updateShaderTimeUniforms();
  }
  
  // Add a method to update shader time uniforms
  updateShaderTimeUniforms() {
    const time = performance.now() * 0.001; // Get current time in seconds

    // Update event horizon shader time
    if (this.eventHorizon && this.eventHorizon.material && this.eventHorizon.material.uniforms) {
      this.eventHorizon.material.uniforms.time.value = time;
    }
    
    // Update distortion field shader time
    if (this.distortionField && this.distortionField.material && this.distortionField.material.uniforms) {
      this.distortionField.material.uniforms.time.value = time;
    }
  }
  
  canAbsorb(celestialObject) {
    // Check if the black hole can absorb this object based on mass
    return this.mass > celestialObject.mass;
  }
  
  checkAbsorption(celestialObject) {
    if (celestialObject.isAbsorbed) return false;
    
    const distance = this.position.distanceTo(celestialObject.position);
    const absorptionRadius = this.getRadius() * 2 + celestialObject.getRadius();
    
    if (distance <= absorptionRadius) {
      console.log(`Object absorbed! Type: ${celestialObject.type}, Mass: ${celestialObject.mass.toFixed(2)}, Distance: ${distance.toFixed(2)}`);
      
      // Increase mass based on object's mass (20%)
      this.increaseMass(celestialObject.mass * 0.2);
      
      // Mark the object as absorbed
      celestialObject.isAbsorbed = true;
      
      // Call the callback if it exists
      if (this.onObjectAbsorbed) {
        this.onObjectAbsorbed(celestialObject);
      }
      
      return true;
    }
    
    return false;
  }
  
  update(deltaTime, celestialObjects) {
    // Update shader time uniforms for animations
    this.updateShaderTimeUniforms();
    
    // Check for collisions and absorptions
    if (celestialObjects) {
      for (const object of celestialObjects) {
        if (!object.isAbsorbed) {
          if (this.checkAbsorption(object)) {
            // Mark the object as absorbed
            object.isAbsorbed = true;
            
            // Call the callback if defined
            if (typeof this.onObjectAbsorbed === 'function') {
              this.onObjectAbsorbed(object);
            }
          }
        }
      }
    }
    
    // Set black hole position
    this.mesh.position.z = 0; // Set to appropriate z-depth
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
} 