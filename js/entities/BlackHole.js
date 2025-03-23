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
    const absorptionRadius = this.getRadius() * 2 + celestialObject.getRadius();
    
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
    
    // Determine the "top" of the black hole relative to camera view
    // In a top-down view, the up direction is considered the normal facing the camera
    // We'll use the z-axis as the "up" direction in our 3D space
    const upDirection = new THREE.Vector3(0, 0, 1);
    
    // Create animation function
    const animateAbsorption = () => {
      // Calculate elapsed time
      const currentTime = performance.now() / 1000;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      
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
      
      // Move toward current black hole position with spiral
      const distanceFactor = Math.pow(1 - easeProgress, 1.2); // Slower approach
      
      // Adjust the target position to account for black hole movement
      const targetPosition = currentBlackHolePosition.clone();
      
      // Adjust starting position to account for black hole movement
      const adjustedInitialPosition = new THREE.Vector3().addVectors(
        initialPosition,
        blackHoleOffset.clone().multiplyScalar(0.5) // 50% follow black hole movement
      );
      
      // Calculate position in the spiral plane (x-y)
      const spiralX = adjustedInitialPosition.x + (targetPosition.x - adjustedInitialPosition.x) * easeProgress;
      const spiralY = adjustedInitialPosition.y + (targetPosition.y - adjustedInitialPosition.y) * easeProgress;
      
      // Add spiral effect in the x-y plane
      const scaledDistance = distance * radiusRatio;
      const spiralRadius = scaledDistance * distanceFactor * spiralTightness;
      const finalX = spiralX + Math.cos(angle) * spiralRadius * (1 - easeProgress * 0.7);
      const finalY = spiralY + Math.sin(angle) * spiralRadius * (1 - easeProgress * 0.7);
      
      // Calculate z-position - move object up slightly above the black hole during absorption
      // This creates the effect of spiraling toward the "top" of the black hole
      const initialZ = adjustedInitialPosition.z || 0;
      const targetZ = targetPosition.z || 0;
      
      // Create a bell curve that peaks at the middle of the animation and returns near the end
      const zOffset = Math.sin(progress * Math.PI) * currentBlackHoleRadius * 0.5;
      const finalZ = initialZ + (targetZ - initialZ) * easeProgress + zOffset;
      
      // Update object position
      object.position.set(finalX, finalY, finalZ);
      object.mesh.position.copy(object.position);
      
      // Make objects stretch MORE as they approach the black hole center
      const stretchDirection = new THREE.Vector3()
        .subVectors(targetPosition, object.position)
        .normalize();
      
      // Add an upward component to the stretch direction for the "top" absorption effect
      stretchDirection.z += upDirection.z * (1 - distanceFactor) * 0.5;
      stretchDirection.normalize();
      
      // Calculate distance-based scaling to ensure planets stay visible
      const distToCenter = object.position.distanceTo(targetPosition);
      const scaledBlackHoleRadius = currentBlackHoleRadius;

      // Only start shrinking when closer to the center, scaled by black hole size
      let shrinkFactor = 1.0;
      if (distToCenter < scaledBlackHoleRadius * 2.5) {
        shrinkFactor = distToCenter / (scaledBlackHoleRadius * 2.5);
        shrinkFactor = Math.max(0.4, shrinkFactor); // Don't shrink below 40%
      }
      
      // Keep objects larger than before
      const newScale = initialScale.clone().multiplyScalar(shrinkFactor);
      object.mesh.scale.copy(newScale);
      
      // More dramatic stretching effect toward black hole center and upward
      const stretchFactor = Math.min(5, 1 + (1 - shrinkFactor) * 6 * radiusRatio);
      object.mesh.scale.x *= (1 + stretchDirection.x * stretchFactor);
      object.mesh.scale.y *= (1 + stretchDirection.y * stretchFactor);
      object.mesh.scale.z *= (1 + stretchDirection.z * stretchFactor * 1.5); // Extra stretching in the z direction
      
      // Keep opacity higher until very close to center
      let opacity = 1.0;
      if (distToCenter < scaledBlackHoleRadius) {
        // Scale opacity threshold by black hole size
        opacity = distToCenter / scaledBlackHoleRadius;
      }
      
      // Fade out as it's absorbed, but more gradually
      if (object.mesh.material) {
        if (object.mesh.material.opacity !== undefined) {
          object.mesh.material.opacity = opacity;
          // Ensure transparent is enabled if we're modifying opacity
          object.mesh.material.transparent = true;
        } else if (object.mesh.material.uniforms && object.mesh.material.uniforms.opacity) {
          object.mesh.material.uniforms.opacity.value = opacity;
          // Ensure transparent is enabled
          object.mesh.material.transparent = true;
        }
      }
      
      // Check if animation is complete
      if (progress < 1.0 && !object.isAbsorbed) {
        requestAnimationFrame(animateAbsorption);
      } else {
        // Mark as fully absorbed
        object.isAbsorbed = true;
        
        // Increase mass based on absorbed object
        this.increaseMass(object.mass * 0.025);
        
        // Call the callback if it exists
        if (this.onObjectAbsorbed) {
          this.onObjectAbsorbed(object);
        }
      }
    };
    
    // Start animation
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