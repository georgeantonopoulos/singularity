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
    
    // For 3D, use a sphere geometry for the event horizon for depth effects
    const geometry = new THREE.SphereGeometry(this.getRadius() * 1.5, 64, 32);
    
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
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDepth;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mvPosition.z;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float mass;
        uniform float radius;
        uniform float gravitationalLensingEffect;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDepth;
        
        void main() {
          // Use the normal and depth for 3D shading
          vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
          float diffuse = max(0.0, dot(vNormal, lightDir));
          
          // Calculate distance from center for radial effects
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(vUv, center) * 2.0;
          
          // Create a true sphere appearance by using normal.z
          // This makes the edges naturally fade based on the curvature
          float edgeFade = pow(max(0.0, vNormal.z), 2.0);
          
          // Mix edge color for a subtle rim effect
          vec3 innerColor = vec3(0.0, 0.0, 0.0);  // Pure black center
          vec3 edgeColor = vec3(0.05, 0.02, 0.1); // Very dark purple-ish edge
          
          // Rim highlight is stronger where surface curves away
          float rimLight = pow(1.0 - max(0.0, vNormal.z), 4.0) * 0.3;
          
          // Create subtle time-based wavy distortion at the edge
          float timeWave = sin(time * 0.5 + dist * 10.0) * 0.5 + 0.5;
          float edgeGlow = smoothstep(0.7, 0.95, dist) * timeWave * 0.2;
          
          // Final color combines all effects
          vec3 color = mix(innerColor, edgeColor, smoothstep(0.5, 1.0, dist));
          color += vec3(0.05, 0.01, 0.1) * rimLight; // Add subtle rim lighting
          color += vec3(0.02, 0.01, 0.05) * edgeGlow; // Add edge glow effect
          
          // Add faint diffuse lighting for 3D appearance
          color += vec3(0.02, 0.01, 0.03) * diffuse;
          
          // Fully opaque black hole
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: false, // No transparency for the black hole
      depthWrite: true,   // Write to depth buffer
      side: THREE.FrontSide // Only render front faces
    });
    
    this.eventHorizon = new THREE.Mesh(geometry, material);
    // Position the event horizon slightly back to allow for distortion field
    this.eventHorizon.position.z = -0.2;
    this.mesh.add(this.eventHorizon);
    
    // Create a visual distortion effect
    this.createDistortionField();
    
    // Important: Add the distortion field AFTER the event horizon
    // so it renders on top for proper lens effect
    this.mesh.add(this.distortionField);
    
    // Initialize animation properties for smooth growth
    this.targetRadius = this.getRadius();
    this.currentRadius = this.getRadius();
    this.growthSpeed = 1.0; // Speed multiplier for growth animation
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
    // Visual distortion field (gravitational lensing effect)
    // Only slightly larger than the black hole (10% larger)
    const distortionRadius = this.getRadius() * 1.65; // Slightly larger than event horizon
    const distortionGeometry = new THREE.SphereGeometry(distortionRadius, 64, 32);
    
    // Use a custom shader material for the distortion effect
    const distortionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        mass: { value: this.mass },
        radius: { value: this.getRadius() },
        distortionStrength: { value: 0.3 + (this.mass - 1) * 0.05 } // Increased strength for better effect
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float mass;
        uniform float radius;
        uniform float distortionStrength;
        
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
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
          
          // Use normal vector to create a 3D falloff
          float normalFade = max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
          
          // Add subtle pulsation and time variance
          float timePulse = sin(time * 0.5) * 0.05 + 0.95;
          float timeVarying = (sin(dist * 20.0 - time * 2.0) * 0.5 + 0.5) * 0.2;
          
          // Very dark color with subtle purple tint to match the event horizon
          vec3 baseColor = vec3(0.01, 0.005, 0.02);
          
          // Combine all effects 
          vec3 color = baseColor * (distortionIntensity + einsteinRing + timeVarying) * timePulse;
          
          // Alpha is stronger near the event horizon and fades out at larger distances
          // Also fade based on view angle for a more 3D effect
          float alpha = (distortionIntensity + einsteinRing * 0.5) * 0.4; // Increased opacity
          alpha *= smoothstep(1.0, 0.3, dist); // Fade out with distance more gradually
          alpha *= pow(1.0 - normalFade, 2.0); // Fade at edges based on normal
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false, // Don't write to depth buffer so it renders on top
      depthTest: true,   // But still test against depth buffer
      side: THREE.FrontSide, // Only render front faces
      renderOrder: 10    // Force it to render after all other objects
    });
    
    this.distortionField = new THREE.Mesh(distortionGeometry, distortionMaterial);
    this.distortionField.position.z = 0.05; // Slightly in front of the event horizon
    this.distortionField.renderOrder = 10; // Ensure it renders after other objects
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
    const invSquare = this.gravitationalConstant * this.mass * objectMass / (distance * distance);
    const invLinear = this.gravitationalConstant * this.mass * objectMass / distance;
    let t = (distance - 30) / 20;
    t = Math.max(0, Math.min(1, t));
    let forceMagnitude = (1 - t) * invSquare + t * invLinear;
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
          this.mesh.children[1].material.uniforms.distortionStrength.value = 
            0.3 + (this.mass - 1) * 0.05; // Increase with mass
        }
      }
    }
    
    // Set the target radius for smooth animation
    this.targetRadius = this.getRadius();
    this.updateVisuals();
  }
  
  updateVisuals() {
    if (!this.mesh) return;
    
    // Smoothly interpolate current radius towards target
    const diff = this.targetRadius - this.currentRadius;
    this.currentRadius += diff * 0.05; // 5% per frame for smooth transition
    
    // Don't update geometries on every frame - only when meaningful change occurs
    if (Math.abs(diff) > 0.001) {
      // Update event horizon
      if (this.eventHorizon) {
        // Update material uniforms
        if (this.eventHorizon.material && this.eventHorizon.material.uniforms) {
          this.eventHorizon.material.uniforms.radius.value = this.currentRadius;
          this.eventHorizon.material.uniforms.mass.value = this.mass;
        }
        
        // Update geometry smoothly rather than replacing it
        this.eventHorizon.scale.set(
          this.currentRadius / this.getRadius(), 
          this.currentRadius / this.getRadius(), 
          this.currentRadius / this.getRadius()
        );
      }
      
      // Update distortion field
      if (this.distortionField) {
        // Update material uniforms
        if (this.distortionField.material && this.distortionField.material.uniforms) {
          this.distortionField.material.uniforms.radius.value = this.currentRadius;
          this.distortionField.material.uniforms.mass.value = this.mass;
          this.distortionField.material.uniforms.distortionStrength.value = 0.3 + (this.mass - 1) * 0.05;
        }
        
        // Scale the distortion field slightly larger than the event horizon
        const distortionScale = this.currentRadius / this.getRadius();
        this.distortionField.scale.set(distortionScale, distortionScale, distortionScale);
      }
    }
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
  
  // Add this method to animate objects being absorbed
  animateObjectAbsorption(object) {
    if (!object || !object.mesh) return;
    
    // Store the original position if not already stored
    if (!object._originalZ) {
      object._originalZ = object.mesh.position.z;
    }
    
    // Calculate distance to black hole
    const dist = this.position.distanceTo(object.position);
    const blackHoleRadius = this.getRadius() * 1.5;
    
    // As the object gets closer to the black hole, move it forward in Z
    // This creates the effect of objects passing in front of the black hole
    const threshold = blackHoleRadius * 3; // Start moving forward at this distance
    const minDist = blackHoleRadius * 0.5; // At this distance, start moving back
    
    if (dist < threshold && dist > minDist) {
      // Move forward proportionally to how close it is to the black hole
      const factor = 1.0 - (dist - minDist) / (threshold - minDist);
      const zOffset = factor * 0.5; // Max z-offset of 0.5
      
      // Apply z-offset to make it appear in front of the black hole
      object.mesh.position.z = object._originalZ + zOffset;
    } 
    else if (dist <= minDist) {
      // When very close, start moving back behind the black hole
      const factor = Math.max(0, dist / minDist);
      const zOffset = (factor - 1.0) * 0.5; // Goes from 0 to -0.5
      
      // Apply z-offset to make it disappear behind the black hole
      object.mesh.position.z = object._originalZ + zOffset;
    }
  }
  
  update(deltaTime, celestialObjects) {
    // Update shader time uniforms for animations
    this.updateShaderTimeUniforms();
    
    // Update the smooth growth animation
    this.updateVisuals();
    
    // Process all objects for z-position adjustments and absorptions
    if (celestialObjects) {
      for (const object of celestialObjects) {
        if (!object.isAbsorbed) {
          // Apply z-adjustment to make objects appear in front of black hole
          this.animateObjectAbsorption(object);
          
          // Check for absorption
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