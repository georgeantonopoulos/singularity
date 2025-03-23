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
    // For 2D, we use a circle geometry for the black hole
    const geometry = new THREE.CircleGeometry(this.getRadius(), 64);
    
    // Use a custom shader material for the black hole
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        mass: { value: this.mass },
        gravitationalLensingEffect: { value: this.gravitationalLensingEffect }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    
    // Create accretion disk (for 2D, this is a ring)
    this.createAccretionDisk();
    
    // Create a visual distortion effect
    this.createDistortionField();
    
    // Group everything together
    const group = new THREE.Group();
    group.add(this.mesh); // Black hole core
    group.add(this.accretionDisk); // Accretion disk
    group.add(this.distortionField); // Visual distortion
    
    this.mesh = group;
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
      fragmentShader: distortionFieldFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    this.distortionField = new THREE.Mesh(distortionGeometry, distortionMaterial);
    this.distortionField.position.z = -0.1; // Slightly behind the black hole
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
      
      // Update accretion disk
      if (this.mesh.children[1] && this.mesh.children[1].material && this.mesh.children[1].material.uniforms) {
        this.mesh.children[1].material.uniforms.mass.value = this.mass;
      }
      
      // Update distortion field
      if (this.mesh.children[2] && this.mesh.children[2].material && this.mesh.children[2].material.uniforms) {
        this.mesh.children[2].material.uniforms.mass.value = this.mass;
        
        if (this.mesh.children[2].material.uniforms.distortionStrength) {
          this.mesh.children[2].material.uniforms.distortionStrength.value = 0.2 + (this.mass - 1) * 0.05; // Increase with mass
        }
      }
    }
    
    this.updateVisuals();
  }
  
  updateVisuals() {
    // Update black hole radius
    const newRadius = this.getRadius();
    const blackHoleMesh = this.mesh.children[0];
    
    // Scale the black hole
    blackHoleMesh.scale.set(1, 1, 1);
    
    // Create new geometry with updated radius
    blackHoleMesh.geometry.dispose(); // Clean up the old geometry
    blackHoleMesh.geometry = new THREE.CircleGeometry(newRadius, 64);
    
    // Update accretion disk
    const diskRadius = newRadius * 3;
    const accretionDisk = this.mesh.children[1];
    
    // Create new geometry for accretion disk
    accretionDisk.geometry.dispose();
    accretionDisk.geometry = new THREE.RingGeometry(
      newRadius * 1.2, 
      diskRadius, 
      64, 
      8
    );
    
    // Update the distortion field
    const distortionField = this.mesh.children[2];
    const distortionRadius = newRadius * 6;
    
    // Create new geometry for distortion field
    distortionField.geometry.dispose();
    distortionField.geometry = new THREE.CircleGeometry(distortionRadius, 64);
    
    // Update uniforms
    if (distortionField.material.uniforms) {
      distortionField.material.uniforms.radius.value = newRadius;
      distortionField.material.uniforms.distortionStrength.value = 0.2 + (this.mass - 1) * 0.05; // Increase with mass
    }
    
    // Update shader time uniforms for animations
    this.updateShaderTimeUniforms();
  }
  
  // Add a method to update shader time uniforms
  updateShaderTimeUniforms() {
    const time = performance.now() * 0.001; // Get current time in seconds

    // Update black hole core shader time
    if (this.mesh.children[0] && this.mesh.children[0].material && this.mesh.children[0].material.uniforms) {
      this.mesh.children[0].material.uniforms.time.value = time;
    }
    
    // Update accretion disk shader time
    if (this.mesh.children[1] && this.mesh.children[1].material && this.mesh.children[1].material.uniforms) {
      this.mesh.children[1].material.uniforms.time.value = time;
    }
    
    // Update distortion field shader time
    if (this.mesh.children[2] && this.mesh.children[2].material && this.mesh.children[2].material.uniforms) {
      this.mesh.children[2].material.uniforms.time.value = time;
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