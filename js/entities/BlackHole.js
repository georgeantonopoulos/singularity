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
      transparent: false, // Make it completely opaque
      depthWrite: true,   // Enable depth writing
      depthTest: true     // Enable depth testing
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.renderOrder = -1; // Ensure it renders BEHIND other objects
    
    // Add to parent object or scene
    if (this.parent) {
      this.parent.add(this.mesh);
    } else if (this.scene) {
      this.scene.add(this.mesh);
    }
    
    return this.mesh;
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
    if (this.mesh && this.mesh.material && this.mesh.material.uniforms) {
      this.mesh.material.uniforms.radius.value = this.getRadius();
      this.mesh.material.uniforms.intensity.value = Math.min(0.7 + (this.mass * 0.01), 1.0);
    }
    
    this.updateVisuals();
  }
  
  updateVisuals() {
    if (!this.mesh) return;
    
    const currentRadius = this.getRadius();
    
    // Update size
    this.mesh.scale.set(1, 1, 1);
    
    // Update shader uniforms
    if (this.mesh.material.uniforms) {
      this.mesh.material.uniforms.radius.value = currentRadius;
      this.mesh.material.uniforms.intensity.value = Math.min(0.7 + (this.mass * 0.01), 1.0);
    }
  }
  
  // Update shader time uniforms for animations
  updateShaderTimeUniforms(deltaTime) {
    if (this.mesh && this.mesh.material && this.mesh.material.uniforms) {
      this.mesh.material.uniforms.time.value += deltaTime;
    }
  }
  
  canAbsorb(celestialObject) {
    // Check if the black hole can absorb this object based on mass
    return this.mass > celestialObject.mass;
  }
  
  checkAbsorption(celestialObject) {
    if (celestialObject.isAbsorbed) return false;
    
    const distance = this.position.distanceTo(celestialObject.position);
    // Increased multiplier from 2 to 4 to ensure the absorption radius scales with black hole growth
    const absorptionRadius = this.getRadius() * 4 + celestialObject.getRadius();
    
    if (distance <= absorptionRadius) {
      console.log(`Object absorption started! Type: ${celestialObject.type}, Mass: ${celestialObject.mass.toFixed(2)}, Distance: ${distance.toFixed(2)}`);
      
      // Start absorption animation instead of immediately absorbing
      this.animateObjectAbsorption(celestialObject, distance);
      
      return true;
    }
    
    return false;
  }
  
  animateObjectAbsorption(object, distance) {
    // Don't re-absorb objects
    if (object.isBeingAbsorbed || object.isAbsorbed) return;
    
    // Mark object as being absorbed so we don't trigger this again
    object.isBeingAbsorbed = true;
    
    // Store initial properties for animation
    const initialScale = object.mesh.scale.clone();
    const initialPosition = object.position.clone();
    const initialBlackHolePosition = this.position.clone();
    const initialBlackHoleRadius = this.getRadius();
    
    // Duration of animation in seconds - make it longer for better visibility
    const duration = 1.8; 
    const startTime = performance.now() / 1000;
    
    // Determine the "up" vector for the spiraling animation
    // Use a combination of camera direction and black hole position
    // This ensures the spiral is visible from the player's perspective
    const upVector = new THREE.Vector3(0, 0, 1);
    
    // Get vector from object to black hole for the spiral plane
    const objectToBlackHole = new THREE.Vector3().subVectors(
      this.position,
      initialPosition
    ).normalize();
    
    // Create a right vector perpendicular to up and object-to-blackhole
    const rightVector = new THREE.Vector3().crossVectors(upVector, objectToBlackHole).normalize();
    
    // Create a new up vector that's perpendicular to object-to-blackhole and right
    // This ensures our spiral plane is properly oriented in 3D space
    const spiralUpVector = new THREE.Vector3().crossVectors(objectToBlackHole, rightVector).normalize();
    
    // Create animation function
    const animateAbsorption = () => {
      // Calculate elapsed time
      const currentTime = performance.now() / 1000;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      
      // Calculate delta time for smooth rotation regardless of frame rate
      const deltaTime = Math.min(0.1, elapsed - (animateAbsorption.lastTime || 0));
      animateAbsorption.lastTime = elapsed;
      
      // Use easing function for smoother spiral
      const easeProgress = 1 - Math.pow(1 - progress, 2); // Quadratic ease out
      
      // Get current black hole position and size - these may have changed since animation started
      const currentBlackHolePosition = this.position.clone();
      const currentBlackHoleRadius = this.getRadius();
      
      // Calculate offset from initial black hole position to current position
      const blackHoleOffset = new THREE.Vector3().subVectors(
        currentBlackHolePosition, 
        initialBlackHolePosition
      );
      
      // Calculate scaling factor between initial and current black hole size
      const radiusRatio = currentBlackHoleRadius / initialBlackHoleRadius;
      
      // Calculate spiral parameters
      const angle = progress * Math.PI * 10; // 10 full rotations during the animation
      const spiralTightness = 0.9;
      
      // Get the object's initial distance to update spiral properly
      const initialDist = initialPosition.distanceTo(initialBlackHolePosition);
      
      // Calculate current distance from the center, getting smaller as animation progresses
      const currentDist = initialDist * (1 - easeProgress);
      
      // Calculate position on the spiral in the plane perpendicular to the black hole direction
      // This creates a true 3D spiral effect now
      
      // Calculate the position along the spiral
      // Start at the initial position and spiral inward toward the black hole
      
      // Calculate the spiral components
      const spiralX = Math.cos(angle) * currentDist * spiralTightness;
      const spiralY = Math.sin(angle) * currentDist * spiralTightness;
      
      // Create vectors for the spiral plane
      const tangentVector = rightVector.clone().multiplyScalar(spiralX);
      const normalVector = spiralUpVector.clone().multiplyScalar(spiralY);
      
      // Calculate intermediate point between object and black hole
      const midPoint = new THREE.Vector3().lerpVectors(
        initialPosition,
        currentBlackHolePosition,
        easeProgress
      );
      
      // Add spiral offset to the midpoint
      const newPosition = midPoint.clone()
        .add(tangentVector)
        .add(normalVector);
      
      // Update the object's position
      object.position.copy(newPosition);
      object.mesh.position.copy(newPosition);
      
      // Scale down as the object gets closer to the black hole
      const currentScale = 1 - easeProgress * 0.8;
      object.mesh.scale.set(currentScale, currentScale, currentScale);
      
      // Add rotation effect for more dramatic animation
      const rotationSpeed = 5.0;
      object.mesh.rotation.x += rotationSpeed * deltaTime;
      object.mesh.rotation.y += rotationSpeed * deltaTime;
      object.mesh.rotation.z += rotationSpeed * deltaTime;
      
      // If animation is complete
      if (progress >= 1.0) {
        // Mark object as absorbed
        object.isAbsorbed = true;
        
        // Update black hole mass - scale factor based on object type
        // Use MUCH smaller percentages of object mass (similar to original 2.5%)
        let massFactor = 0.025; // Default/baseline factor (same as original)
        
        // Differentiate absorption by object type with small adjustments
        if (object.type === 'star') {
          // Stars provide slightly more than the default
          massFactor = 0.03;
        } else if (object.type === 'planet') {
          // Planets provide the default amount
          massFactor = 0.025;
        } else if (object.type === 'debris') {
          // Debris provides slightly less than the default
          massFactor = 0.02;
        }
        
        // Increment black hole mass
        this.increaseMass(object.mass * massFactor);
        
        // Trigger any object-absorbed callbacks
        if (this.onObjectAbsorbed) {
          this.onObjectAbsorbed(object);
        }
      } else {
        // Continue animation on next frame
        requestAnimationFrame(animateAbsorption);
      }
    };
    
    // Start the animation
    animateAbsorption();
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
      position: this.mesh.position.clone(), // 3D world position
      radius: this.getRadius(),                  // Current radius in world units
      mass: this.mass                       // Current mass value
    };
  }
} 