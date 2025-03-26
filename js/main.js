import { THREE, OrbitControls, EffectComposer, RenderPass, UnrealBloomPass } from './libs/three-setup.js';
import { BlackHole } from './entities/BlackHole.js';
import { CelestialObject } from './entities/CelestialObject.js';
import { generateCelestialObjects } from './utils/objectGenerator.js';
import { setupLighting } from './utils/lighting.js';
import { createStarfield } from './utils/starfield.js';
import { lensPostProcessingVertexShader, lensPostProcessingFragmentShader } from './shaders/blackHoleShaders.js';
import { BlackHoleLensEffect } from './libs/BlackHoleLensEffect.js';
import { GalaxyCluster } from './entities/GalaxyCluster.js';
import { Interaction } from './libs/interaction.js';

// At the top of the file, after imports
console.log("Main.js loaded with ES6 modules");

// Define Game class first
class Game {
  constructor() {
    console.log("Game constructor started");
    this.canvas = document.getElementById('game-canvas');
    this.massCounter = document.getElementById('current-mass');
    this.timeRemainingEl = document.getElementById('time-remaining');
    this.startScreen = document.getElementById('start-screen');
    this.gameOverScreen = document.getElementById('game-over');
    this.finalMassEl = document.getElementById('final-mass');
    this.startButton = document.getElementById('start-button');
    this.restartButton = document.getElementById('restart-button');

    console.log("DOM elements:", {
      canvas: this.canvas,
      startScreen: this.startScreen,
      startButton: this.startButton,
      restartButton: this.restartButton
    });

    // Game state
    this.isRunning = false;
    this.celestialObjects = [];
    this.galaxyClusters = [];
    this.gameTimeInSeconds = Infinity; // No time limit
    this.timeRemaining = this.gameTimeInSeconds;
    this.frameCount = 0; // Counter for frame-based operations
    
    // Mouse position and target position for lerping
    this.mouse = new THREE.Vector2();
    this.worldMouse = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.lerpFactor = 0.05; // How fast the black hole moves to target (0-1)
    
    // Game area size
    this.gameWidth = 100;
    this.gameHeight = 60;
    
    // Camera animation properties - keep these but they won't be used
    this.cameraAnimationActive = false;
    this.cameraTargetPosition = new THREE.Vector3(0, 0, 0);
    this.cameraOriginalPosition = new THREE.Vector3(0, 0, 0);
    this.cameraAnimationStartTime = 0;
    this.cameraAnimationDuration = 2.5; // seconds
    this.cameraSizeThresholdTriggered = false;
    this.cameraSizeThresholdTimestamp = 0;
    this.cameraSizeThresholdDelay = 3; // seconds
    
    // Initialize the game
    this.setupEventListeners();
    this.initThree();
    console.log("Game constructor completed");
  }

  setupEventListeners() {
    // UI elements
    this.startButton = document.getElementById('start-button');
    this.restartButton = document.getElementById('restart-button');
    this.gameOverContainer = document.getElementById('game-over');
    
    // Create new Interaction instance if it doesn't exist
    if (!this.interaction) {
      this.interaction = new Interaction(this.canvas, {
        panEnabled: true,
        zoomEnabled: true,
        panSpeed: 2.0,
        zoomSpeed: 8.0
      });
      
      // Set camera for the interaction system
      this.interaction.setCamera(this.camera);
      
      // Register click callback to handle black hole movement
      this.interaction.on('click', (mouse) => {
        if (!this.isRunning) return;
        this.onCanvasClick({ 
          clientX: mouse.x + this.canvas.getBoundingClientRect().left,
          clientY: mouse.y + this.canvas.getBoundingClientRect().top
        });
      });
    }
    
    // Add start button listener with direct reference to function
    const handleStartClick = () => {
      console.log("Start button clicked!");
      this.startGame();
    };
    
    // Remove any existing listener first
    this.startButton.removeEventListener('click', handleStartClick);
    
    // Add new listener with direct reference to function
    this.startButton.addEventListener('click', handleStartClick);
    console.log("Start button event listener added");
    
    // Restart button with similar pattern
    if (this.restartButton) {
      const handleRestartClick = () => {
        console.log("Restart button clicked!");
        this.restartGame();
      };
      
      this.restartButton.removeEventListener('click', handleRestartClick);
      this.restartButton.addEventListener('click', handleRestartClick);
      console.log("Restart button event listener added");
    }
    
    // Handle resize
    window.addEventListener('resize', () => this.onWindowResize());
    
    // IMPORTANT: Removed direct canvas click event listener
    // Now using the Interaction class for all canvas input
  }
  
  onCanvasClick(event) {
    if (!this.isRunning) return;
    
    // IMPORTANT: Ignore middle mouse and right mouse button clicks for black hole movement
    // This prevents conflicts with camera panning
    if (event.button === 1 || event.button === 2) {
      return;
    }
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Create a ray from the camera position through the mouse position
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    
    // Create a plane at z=0 (game plane)
    const gamePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    
    // Find where the ray intersects the game plane
    const worldPos = new THREE.Vector3();
    raycaster.ray.intersectPlane(gamePlane, worldPos);
    
    // Limit the target position to the game area bounds
    const targetX = Math.max(-this.gameWidth/2, Math.min(this.gameWidth/2, worldPos.x));
    const targetY = Math.max(-this.gameHeight/2, Math.min(this.gameHeight/2, worldPos.y));
    
    // Set the target position for lerping
    this.targetPosition.set(targetX, targetY, 0);
    
    console.log("Black hole target set to:", this.targetPosition);
  }
  
  updateBlackHolePosition() {
    if (!this.blackHole || !this.camera) return;
    
    // Smoothly move black hole towards target position (lerp)
    if (this.targetPosition) {
      // Calculate distance to target (only x and y components)
      const xyDistance = Math.sqrt(
        Math.pow(this.blackHole.position.x - this.targetPosition.x, 2) +
        Math.pow(this.blackHole.position.y - this.targetPosition.y, 2)
      );
      
      // Only update if we're not already very close
      if (xyDistance > 0.1) {
        // Create a temporary target that preserves the z position
        const tempTarget = new THREE.Vector3(
          this.targetPosition.x,
          this.targetPosition.y,
          this.blackHole.position.z  // Keep original z position
        );
        
        // Use a smaller lerp factor for slower movement
        const slowLerpFactor = this.lerpFactor * 0.3; // Slower speed
        this.blackHole.position.lerp(tempTarget, slowLerpFactor);
        
        // Update the visual representation (group or mesh)
        if (this.blackHole.group) {
          this.blackHole.group.position.copy(this.blackHole.position);
        } else if (this.blackHole.mesh) {
          this.blackHole.mesh.position.copy(this.blackHole.position);
        }
      }
    }
    
    // Check for alignment with celestial objects and create visual cue
    this.checkAlignmentWithObjects();
    
    // Empty call to checkBlackHoleSizeForCameraAdjustment (disabled)
    // We keep the call but the function does nothing
    this.checkBlackHoleSizeForCameraAdjustment();
  }
  
  // Disabled camera adjustment methods - keep as empty stubs to maintain references
  // Empty stub function for checkBlackHoleSizeForCameraAdjustment
  checkBlackHoleSizeForCameraAdjustment() {
    // This function is intentionally disabled
    return;
  }
  
  // Empty stub function for resetCameraPosition
  resetCameraPosition() {
    // This function is intentionally disabled
    return;
  }
  
  // Empty stub function for startCameraAnimation
  startCameraAnimation() {
    // This function is intentionally disabled
    return;
  }
  
  // New method to check for alignment with celestial objects
  checkAlignmentWithObjects() {
    if (!this.blackHole || !this.celestialObjects || this.celestialObjects.length === 0) return;
    
    // Remove existing alignment indicator if present
    if (this.alignmentIndicator) {
      this.scene.remove(this.alignmentIndicator);
      this.alignmentIndicator = null;
    }
    
    // Calculate a much wider radius for alignment detection
    // Using a significant portion of the game area width for wider detection
    const alignmentRadius = this.gameWidth * 0.15; // Much wider alignment radius - 15% of game width
    
    // Find nearby objects that might be aligned with the black hole
    let closestAlignedObject = null;
    let closestAlignmentDistance = Infinity;
    let strongestAlignmentFactor = 0;
    
    for (const object of this.celestialObjects) {
      if (object.isAbsorbed || object.isBeingAbsorbed) continue;
      
      // Calculate x,y distance (ignoring z)
      const xyDistance = Math.sqrt(
        Math.pow(this.blackHole.position.x - object.position.x, 2) +
        Math.pow(this.blackHole.position.y - object.position.y, 2)
      );
      
      // If within alignment threshold - now using much wider radius
      if (xyDistance < alignmentRadius) {
        // Calculate alignment precision (1.0 = perfect alignment)
        const alignmentPrecision = 1.0 - (xyDistance / alignmentRadius);
        const alignmentFactor = 1.0 + Math.pow(alignmentPrecision, 2) * 3.0;
        
        // Lower threshold to consider alignment (from 1.2 to 1.1)
        if (xyDistance < closestAlignmentDistance && alignmentFactor > 1.1) {
          closestAlignmentDistance = xyDistance;
          closestAlignedObject = object;
          strongestAlignmentFactor = alignmentFactor;
        }
      }
    }
    
    // If we found an aligned object, create a visual indicator
    if (closestAlignedObject && strongestAlignmentFactor > 1.1) {
      // Calculate intensity based on alignment strength (0.0 to 1.0)
      const intensity = Math.min((strongestAlignmentFactor - 1.0) / 3.0, 1.0);
      
      // Create alignment line connecting black hole to object
      const lineGeometry = new THREE.BufferGeometry();
      const start = this.blackHole.position.clone();
      const end = closestAlignedObject.position.clone();
      
      // Create points array for the line
      const points = [start, end];
      lineGeometry.setFromPoints(points);
      
      // Create a shader material with animation
      const lineMaterial = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0x6699ff) }, // Blue alignment beam
          intensity: { value: intensity * 0.7 },        // Scale down intensity a bit
          dashSize: { value: 0.5 },
          gapSize: { value: 0.5 },
          time: { value: 0 }
        },
        vertexShader: `
          uniform float time;
          varying vec3 vPosition;
          
          void main() {
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float intensity;
          uniform float dashSize;
          uniform float gapSize;
          uniform float time;
          varying vec3 vPosition;
          
          void main() {
            // Calculate distance along the line
            float dist = length(vPosition);
            
            // Create animated dashed line effect
            float pattern = fract((dist * 0.5 - time * 2.0) / (dashSize + gapSize));
            float dash = step(pattern, dashSize / (dashSize + gapSize));
            
            // Pulse effect
            float pulse = 0.8 + 0.2 * sin(time * 5.0);
            
            // Edge falloff for a smoother look
            float edge = smoothstep(0.0, 0.1, abs(0.5 - pattern)) * 0.8 + 0.2;
            
            // Final color with all effects
            vec3 finalColor = color * intensity * dash * edge * pulse;
            float alpha = intensity * dash * edge * pulse * 0.8;
            
            gl_FragColor = vec4(finalColor, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      
      // Create the line
      this.alignmentIndicator = new THREE.Line(lineGeometry, lineMaterial);
      this.scene.add(this.alignmentIndicator);
      
      // Store the start time for animation
      this.alignmentIndicator.userData.startTime = performance.now() / 1000;
      this.alignmentIndicator.userData.alignedObject = closestAlignedObject;
      
      // Add this to the animation update loop
      if (!this.updateAlignmentIndicator) {
        this.updateAlignmentIndicator = (deltaTime) => {
          if (this.alignmentIndicator && this.alignmentIndicator.material) {
            // Calculate elapsed time since creation
            const currentTime = performance.now() / 1000;
            const elapsedTime = currentTime - this.alignmentIndicator.userData.startTime;
            
            // Update shader time uniform
            this.alignmentIndicator.material.uniforms.time.value = elapsedTime;
            
            // Update line positions if objects moved
            const alignedObject = this.alignmentIndicator.userData.alignedObject;
            if (this.blackHole && alignedObject && !alignedObject.isAbsorbed) {
              const points = [
                this.blackHole.position.clone(),
                alignedObject.position.clone()
              ];
              this.alignmentIndicator.geometry.dispose();
              this.alignmentIndicator.geometry = new THREE.BufferGeometry().setFromPoints(points);
            }
          }
        };
      }
    }
  }
  
  // Empty placeholder function to avoid reference errors
  updateCameraAnimation(deltaTime) {
    // This function is intentionally left empty
    // The automatic camera adjustment feature has been disabled
    return;
  }
  
  // Helper method for easing animation
  easeOutQuad(t) {
    return t * (2 - t);
  }
  
  // Update orthographic camera projection to match new position
  updateOrthographicCamera() {
    if (!this.camera) return;
    
    // Adjust the orthographic camera size based on z-position
    // Start with the original camera frustum size
    const aspectRatio = window.innerWidth / window.innerHeight;
    const baseSize = 60 / 2; // Half the frustum size
    
    // Calculate a zoom factor based on camera z position (starting from z=80)
    // This ensures the camera zooms out as it moves back
    const zoomFactor = this.camera.position.z / 80;
    
    // Apply the zoom factor to the camera frustum
    const newSize = baseSize * zoomFactor;
    
    // Update the camera frustum
    this.camera.left = -newSize * aspectRatio;
    this.camera.right = newSize * aspectRatio;
    this.camera.top = newSize;
    this.camera.bottom = -newSize;
    
    this.camera.updateProjectionMatrix();
  }

  initThree() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x01020A); // Darker blue-black background
    
    // Create camera - using perspective camera for 3D view
    const aspectRatio = window.innerWidth / window.innerHeight;
    const fov = 40; // Slightly narrower field of view for less distortion
    this.camera = new THREE.PerspectiveCamera(
      fov,
      aspectRatio,
      0.1,
      1000
    );
    // Position camera to get a similar view as original orthographic camera
    this.camera.position.z = 90; // Moved back slightly for better view
    this.camera.lookAt(0, 0, 0);
    
    // Initialize camera controls with interaction system
    // Fix typo: This.Canvas -> this.canvas
    if (!this.interaction) {
      this.interaction = new Interaction(this.canvas, {
        panEnabled: true,
        zoomEnabled: true,
        panSpeed: 2.0,
        zoomSpeed: 8.0
      });
      this.interaction.setCamera(this.camera);
    } else {
      // If interaction already exists, just update the camera
      this.interaction.setCamera(this.camera);
    }
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Set up post-processing with bloom effect
    this.setupPostProcessing();
    
    // Create starfield background - now just on a plane for 2D effect
    this.createStarfield();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Add directional light for subtle shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);
    
    // Add a subtle warm backlight for rim lighting effects
    const backLight = new THREE.DirectionalLight(0xffeecc, 0.25);
    backLight.position.set(-5, -2, -10);
    this.scene.add(backLight);
  }
  
  // Set up post-processing with bloom effect
  setupPostProcessing() {
    // Create a render target for the composer
    const renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth, 
      window.innerHeight, 
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        stencilBuffer: false
      }
    );
    
    // Set up the EffectComposer
    this.composer = new EffectComposer(this.renderer, renderTarget);
    
    // Add the render pass to render the scene
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    // Add bloom effect pass
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.0,    // strength - moderate glow
      0.4,    // radius - for a softer effect
      0.999   // threshold - increased to only pick up very bright areas (stars)
    );
    this.composer.addPass(bloomPass);
    
    // Store the bloom pass for potential adjustments later
    this.bloomPass = bloomPass;
    
    console.log("Post-processing with bloom effect initialized");
  }
  
  // Add a method to set up the lens effect after black hole creation
  setupLensEffect() {
    if (!this.blackHole) {
      console.error("Cannot set up lens effect without a black hole");
      return;
    }
    
    // Don't recreate if already working
    if (this.lensEffect && this.lensEffect.composer && !this.lensEffect.fallbackActive) {
      console.log("Lens effect already set up and working");
      return;
    }
    
    try {
      console.log("Creating new lens effect");
      // Create black hole lens effect
      this.lensEffect = new BlackHoleLensEffect(
        this.renderer,
        this.scene,
        this.camera,
        this.blackHole
      );
      
      // Replace our composer with the lens effect's composer if it was successfully created
      if (this.lensEffect.composer) {
        this.composer = this.lensEffect.composer;
        
        // Add the bloom pass to the lens effect's composer for star glow
        if (this.bloomPass) {
          // Clone the bloom pass and add it to the lens effect composer
          const bloomParams = {
            strength: 1.5,
            radius: 0.4,
            threshold: 0.95  // Increased threshold to only bloom stars
          };
          
          const lensBloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            bloomParams.strength,
            bloomParams.radius,
            bloomParams.threshold
          );
          
          // Add the bloom pass (make sure it's not the last pass)
          this.composer.addPass(lensBloomPass);
          console.log("Added bloom pass to lens effect composer");
        }
        
        console.log("Post-processing lens effect initialized successfully");
      } else {
        console.warn("Failed to create lens effect composer");
      }
    } catch (error) {
      console.error("Failed to set up lens effect:", error);
    }
  }
  
  // Replace the setupPostProcessing method with this more complete implementation
  updateLensEffect() {
    // Use the lens effect's render method which handles everything internally
    if (this.lensEffect && !this.lensEffect.fallbackActive) {
      try {
        this.lensEffect.render();
        return true; // Successfully rendered
      } catch (error) {
        console.warn("Error in lens effect render:", error);
        return false; // Failed to render
      }
    }
    return false; // No lens effect available
  }
  
  createStarfield() {
    // Create a black background plane at far distance
    const backgroundGeometry = new THREE.PlaneGeometry(this.gameWidth * 4, this.gameHeight * 4);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x01020A, // Darker blue-black
      transparent: false,
      depthWrite: false
    });
    const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    backgroundMesh.position.z = -250; // Moved further back for better depth effect
    this.scene.add(backgroundMesh);
    backgroundMesh.layers.set(0); // Make sure it doesn't get bloom

    // Add sparse bright stars with interesting patterns
    this.addSparseBrightStars();
  }
  
  addSparseBrightStars() {
    const starsGroup = new THREE.Group();
    const starCount = 150; // Reverted back to original count
    
    // Generate random stars (60% of total)
    const randomStarCount = Math.floor(starCount * 0.6);
    for (let i = 0; i < randomStarCount; i++) {
      const x = (Math.random() - 0.5) * this.gameWidth * 2.5; // Wider coverage
      const y = (Math.random() - 0.5) * this.gameHeight * 2.5; // Wider coverage
      const size = Math.random() * 2 + 0.5; // Smaller size between 0.5 and 2.5 pixels
      
      // Randomize brightness a bit more
      const brightness = Math.random() * 0.3 + 0.7; // 0.7 to 1.0
      
      const star = this.createStarPoint(x, y, size, brightness);
      starsGroup.add(star);
    }
    
    // Generate pattern-based stars (40% of total)
    const patternStarCount = starCount - randomStarCount;
    this.createStarPatterns(starsGroup, patternStarCount);
    
    this.scene.add(starsGroup);
    starsGroup.layers.set(0); // Make sure it doesn't get bloom
  }
  
  createStarPatterns(group, count) {
    // Distribute stars among different patterns
    const patterns = ['cluster', 'arc', 'line'];
    let remainingStars = count;
    
    // Create 3-4 distinct patterns
    const numPatterns = Math.floor(Math.random() * 2) + 3; // 3 to 4 patterns
    
    for (let i = 0; i < numPatterns && remainingStars > 0; i++) {
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];
      const starsInPattern = Math.floor(remainingStars / (numPatterns - i));
      remainingStars -= starsInPattern;
      
      // Random position for pattern center
      const centerX = (Math.random() - 0.5) * this.gameWidth * 1.5;
      const centerY = (Math.random() - 0.5) * this.gameHeight * 1.5;
      
      switch (pattern) {
        case 'cluster':
          this.createStarCluster(group, centerX, centerY, starsInPattern);
          break;
        case 'arc':
          this.createStarArc(group, centerX, centerY, starsInPattern);
          break;
        case 'line':
          this.createStarLine(group, centerX, centerY, starsInPattern);
          break;
      }
    }
  }
  
  createStarCluster(group, centerX, centerY, count) {
    const radius = Math.random() * 50 + 30; // Cluster radius between 30 and 80
    const densityFactor = Math.random() * 0.5 + 0.5; // Controls how dense the center is
    
    for (let i = 0; i < count; i++) {
      // Use square root to create more density toward the center
      const distance = Math.pow(Math.random(), densityFactor) * radius;
      const angle = Math.random() * Math.PI * 2;
      
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      // Stars closer to center are brighter and potentially larger
      const centerProximity = 1 - (distance / radius);
      const size = Math.random() * 2 + 1 + centerProximity * 1.5;
      const brightness = Math.random() * 0.2 + 0.8 + centerProximity * 0.2;
      
      const star = this.createStarPoint(x, y, size, brightness);
      group.add(star);
    }
  }
  
  createStarArc(group, centerX, centerY, count) {
    const radius = Math.random() * 100 + 50; // Arc radius between 50 and 150
    const arcLength = Math.random() * Math.PI + Math.PI / 2; // Between 90 and 270 degrees
    const startAngle = Math.random() * Math.PI * 2;
    
    for (let i = 0; i < count; i++) {
      const angle = startAngle + (arcLength * (i / (count - 1)));
      
      // Add some randomness to the positions for a natural look
      const distance = radius + (Math.random() - 0.5) * (radius * 0.2);
      
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      const size = Math.random() * 2.5 + 1;
      const brightness = Math.random() * 0.3 + 0.7;
      
      const star = this.createStarPoint(x, y, size, brightness);
      group.add(star);
    }
  }
  
  createStarLine(group, centerX, centerY, count) {
    const length = Math.random() * 150 + 50; // Line length between 50 and 200
    const angle = Math.random() * Math.PI * 2; // Random orientation
    
    const startX = centerX - Math.cos(angle) * (length / 2);
    const startY = centerY - Math.sin(angle) * (length / 2);
    
    for (let i = 0; i < count; i++) {
      // Position along the line with some random offset
      const progress = i / (count - 1);
      const x = startX + Math.cos(angle) * (length * progress) + (Math.random() - 0.5) * 15;
      const y = startY + Math.sin(angle) * (length * progress) + (Math.random() - 0.5) * 15;
      
      const size = Math.random() * 3 + 1;
      const brightness = Math.random() * 0.3 + 0.7;
      
      const star = this.createStarPoint(x, y, size, brightness);
      group.add(star);
    }
  }
  
  createStarPoint(x, y, size, brightness = 1.0) {
    // Create a point sprite for the star
    const material = new THREE.PointsMaterial({
      size: size * 0.5, // Reduced size to make them more star-like
      map: this.getStarTexture(),
      transparent: true,
      opacity: brightness,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    // Add random Z position for depth with perspective camera
    const z = -80 - Math.random() * 150; // Random depth between -80 and -230
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, y, z], 3));
    
    return new THREE.Points(geometry, material);
  }
  
  getStarTexture() {
    // Create and cache the star texture
    if (!this.starTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      
      // Create a radial gradient for the star
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      gradient.addColorStop(0.5, 'rgba(240, 240, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(220, 220, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
      
      this.starTexture = new THREE.CanvasTexture(canvas);
    }
    
    return this.starTexture;
  }
  
  createBlackHole() {
    // Clean up any existing black hole first
    if (this.blackHole) {
      if (this.blackHole.group) {
        this.scene.remove(this.blackHole.group);
      } else if (this.blackHole.mesh) {
        this.scene.remove(this.blackHole.mesh);
      }
      this.blackHole = null;
    }
    
    // If there's an existing glow effect, remove it
    if (this.blackHoleGlow) {
      this.scene.remove(this.blackHoleGlow);
      this.blackHoleGlow = null;
    }
    
    this.blackHole = new BlackHole({
      initialMass: 0.3, // Start with even smaller mass (was 0.5)
      eventHorizonVisuals: true,
      gravitationalLensingEffect: 0.5,
      camera: this.camera  // Pass the camera reference to the black hole
    });
    
    this.blackHole.onObjectAbsorbed = (object) => {
      // Note: The actual mass increase now happens in the BlackHole.animateObjectAbsorption method
      // This is just for visual effects and UI updates
      this.updateVisualEffects();
      this.updateScoreAndUI();
      
      // Add absorption visual effect
      this.createAbsorptionEffect(object.position);
    };
    
    // Keep the x,y position at the center initially, but preserve the z position from BlackHole class
    this.blackHole.position.x = 0;
    this.blackHole.position.y = 0;
    // z position is already set in the BlackHole constructor
    
    // Add the black hole to the scene - use the group if available, otherwise use mesh
    if (this.blackHole.group) {
      this.blackHole.group.position.copy(this.blackHole.position);
      this.scene.add(this.blackHole.group);
    } else if (this.blackHole.mesh) {
      this.blackHole.mesh.position.copy(this.blackHole.position);
      this.scene.add(this.blackHole.mesh);
    }
    
    // Log the black hole's position for debugging
    console.log("Black hole created at position:", this.blackHole.position);
    
    // Set up lens effect - this is now using a fallback renderer
    this.setupLensEffect();
  }
  
  createAbsorptionEffect(position) {
    // Create vector pointing from absorption position toward black hole
    const dirToBlackHole = new THREE.Vector3()
      .subVectors(this.blackHole.position, position)
      .normalize();
    
    // Distance to black hole in 3D space
    const distToBH = this.blackHole.position.distanceTo(position);
    
    // Add shock wave effect at absorption position
    this.createShockWave(position);
    
    // Create accretion disk brightening effect at the black hole position
    const actualRadius = this.blackHole.getRadius();
    const flashGeometry = new THREE.RingGeometry(
      actualRadius * 1.2,
      actualRadius * 2,
      32, 
      2
    );
    
    // Material that brightens the accretion disk
    const flashMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.2 },
        color: { value: new THREE.Color(0x8080BB) }
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
        uniform float intensity;
        uniform vec3 color;
        varying vec2 vUv;
        
        void main() {
          // Make a rotating hot spot
          float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
          float dist = distance(vUv, vec2(0.5, 0.5));
          
          // Create hotspot pattern - reduced spinning speed
          float hotspot = smoothstep(0.3, 0.0, abs(sin(angle * 1.5 + time * 3.0) * 0.5 + 0.5 - dist));
          
          // Pulse effect - reduced intensity
          float pulse = (sin(time * 2.0) * 0.3 + 0.7) * 0.5 + 0.3;
          
          // Apply effects - reduced alpha even further
          vec3 finalColor = color * intensity * hotspot * pulse;
          float alpha = hotspot * intensity * 0.4 * pulse;
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    const diskFlash = new THREE.Mesh(flashGeometry, flashMaterial);
    // Position at black hole center
    diskFlash.position.copy(this.blackHole.position);
    // Offset slightly to be visible above the black hole
    diskFlash.position.z += 0.2;
    // Align with camera rotation
    diskFlash.lookAt(this.camera.position);
    this.scene.add(diskFlash);
    
    // Calculate jet direction perpendicular to both camera view and direction to black hole
    // This ensures jets are always visible from the camera perspective
    const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const jetDirection = new THREE.Vector3().crossVectors(cameraDirection, dirToBlackHole).normalize();
    
    // Create light spikes perpendicular to view direction
    const jetLength = actualRadius * 4;
    const jetGeometry = new THREE.ConeGeometry(actualRadius * 0.2, jetLength, 16, 1, true);
    const jetMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x5050AA) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vDistance;
        
        void main() {
          vUv = uv;
          vDistance = 1.0 - position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        varying float vDistance;
        
        void main() {
          float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
          float pulse = (sin(vDistance * 10.0 - time * 5.0) * 0.3 + 0.7) * 0.5 + 0.5;
          float alpha = edge * (1.0 - vDistance) * 0.3 * pulse;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    
    // Create two jets pointing in opposite directions
    const jet1 = new THREE.Mesh(jetGeometry, jetMaterial.clone());
    jet1.position.copy(this.blackHole.position);
    // Use the quaternion to align with the calculated jet direction
    jet1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), jetDirection);
    this.scene.add(jet1);
    
    const jet2 = new THREE.Mesh(jetGeometry, jetMaterial.clone());
    jet2.position.copy(this.blackHole.position);
    // Point in the opposite direction
    jet2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), jetDirection.clone().negate());
    this.scene.add(jet2);
    
    // Animate everything
    let elapsed = 0;
    
    const animateEffect = () => {
      if (!this.isRunning) {
        this.scene.remove(diskFlash);
        this.scene.remove(jet1);
        this.scene.remove(jet2);
        return;
      }
      
      elapsed += 0.016; // Approx 60fps
      
      // Update shader times
      if (diskFlash.material.uniforms) {
        diskFlash.material.uniforms.time.value = elapsed;
        diskFlash.material.uniforms.intensity.value = Math.max(0, 0.2 - elapsed * 0.2); // Fade out faster
      }
      
      if (jet1.material.uniforms) {
        jet1.material.uniforms.time.value = elapsed;
        jet2.material.uniforms.time.value = elapsed;
      }
      
      // Stretch jets over time
      const jetScaleFactor = 1.0 + elapsed * 0.3; // Reduced scaling
      jet1.scale.y = jetScaleFactor;
      jet2.scale.y = jetScaleFactor;
      
      // Thin jets over time
      const jetWidthFactor = Math.max(0.1, 1.0 - elapsed * 0.5); // Thin out faster
      jet1.scale.x = jetWidthFactor;
      jet1.scale.z = jetWidthFactor;
      jet2.scale.x = jetWidthFactor;
      jet2.scale.z = jetWidthFactor;
      
      // Keep flash ring aligned with camera as it animates
      diskFlash.lookAt(this.camera.position);
      
      // Fade out jets
      jet1.material.opacity = Math.max(0, 0.5 - elapsed * 0.5); // Start at 50% opacity
      jet2.material.opacity = Math.max(0, 0.5 - elapsed * 0.5);
      
      if (elapsed < 1.5) { // Shorter duration
        requestAnimationFrame(animateEffect);
      } else {
        // Remove all effects
        this.scene.remove(diskFlash);
        this.scene.remove(jet1);
        this.scene.remove(jet2);
      }
    };
    
    animateEffect();
  }
  
  // Add a new method for creating the shockwave effect
  createShockWave(position) {
    // Create shockwave ring geometry scaled to black hole size
    const actualRadius = this.blackHole.getRadius();
    const radius = actualRadius * 1.2;
    const segments = 32;
    const geometry = new THREE.RingGeometry(radius * 0.9, radius, segments);
    
    // Create shockwave material with custom shader
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xDDDDDD) },
        intensity: { value: 0.3 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vDistance;
        
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float intensity;
        
        varying vec2 vUv;
        
        void main() {
          // Create a pulse effect
          float alpha = sin(time * 8.0) * 0.2 + 0.5;
          alpha *= smoothstep(1.0, 0.6, time); // Fade out over time
          
          // Less color variation
          vec3 finalColor = mix(color, vec3(1.0, 0.9, 0.8), sin(time * 10.0) * 0.3 + 0.7);
          
          gl_FragColor = vec4(finalColor, alpha * intensity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    // Create mesh
    const shockwave = new THREE.Mesh(geometry, material);
    shockwave.position.copy(position);
    
    // Offset slightly from the absorption position to be visible
    shockwave.position.z += 0.1;
    
    // Calculate the normal that points toward the camera
    const toCamera = new THREE.Vector3().subVectors(this.camera.position, position).normalize();
    
    // Orient the shockwave to face the camera
    const upVector = new THREE.Vector3(0, 1, 0);
    shockwave.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toCamera);
    
    // Add to scene
    this.scene.add(shockwave);
    
    // Animate the shockwave with dynamic scaling based on black hole size
    const startTime = performance.now();
    const duration = 0.6; // Short duration
    const maxScale = 6 + (this.blackHole.mass * 0.5); // Scale based on black hole mass
    
    const updateShockwave = () => {
      const elapsedTime = (performance.now() - startTime) / 1000;
      
      if (elapsedTime > duration || !this.isRunning) {
        this.scene.remove(shockwave);
        geometry.dispose();
        material.dispose();
        return;
      }
      
      // Calculate progress (0 to 1)
      const progress = elapsedTime / duration;
      
      // Update scale - ease out for better visual
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      const scale = 1 + easeOutProgress * maxScale;
      shockwave.scale.set(scale, scale, 1);
      
      // Keep oriented toward camera during animation
      shockwave.lookAt(this.camera.position);
      
      // Update shader uniforms - fade faster
      material.uniforms.time.value = progress;
      material.uniforms.intensity.value = 0.3 * (1 - easeOutProgress);
      
      // Request next frame
      requestAnimationFrame(updateShockwave);
    };
    
    // Start animation
    updateShockwave();
  }
  
  generateObjects() {
    // Generate celestial objects in 3D space with subtle depth
    this.celestialObjects = [];
    
    // Number of objects to generate - reduced to make room for galaxy clusters
    const objectCount = 40;
    
    // Number of galaxy clusters to create
    const clusterCount = 3;
    this.galaxyClusters = [];
    
    // Generate galaxy clusters first
    for (let i = 0; i < clusterCount; i++) {
      // Position clusters further from center to avoid instant absorption
      const clusterDistance = 30 + Math.random() * 25; // Minimum distance from center
      const angle = Math.random() * Math.PI * 2;
      const clusterX = Math.cos(angle) * clusterDistance;
      const clusterY = Math.sin(angle) * clusterDistance;
      const clusterZ = (Math.random() - 0.5) * 10; // Small z variation
      
      // Create random cluster type and size
      const clusterTypes = ['standard', 'binary', 'dense', 'sparse'];
      const clusterSizes = ['small', 'medium', 'large'];
      const clusterType = clusterTypes[Math.floor(Math.random() * clusterTypes.length)];
      const clusterSize = clusterSizes[Math.floor(Math.random() * clusterSizes.length)];
      
      // Create cluster
      const cluster = new GalaxyCluster({
        position: new THREE.Vector3(clusterX, clusterY, clusterZ),
        type: clusterType,
        size: clusterSize,
        scene: this.scene
      });
      
      // Add all objects from the cluster to the game
      const clusterObjects = cluster.getAllObjects();
      for (const obj of clusterObjects) {
        // Add to game object list
        this.celestialObjects.push(obj);
        
        // Add to scene if not already added
        if (!obj.mesh.parent) {
          this.scene.add(obj.mesh);
        }
      }
      
      // Store the cluster
      this.galaxyClusters.push(cluster);
    }
    
    for (let i = 0; i < objectCount; i++) {
      // Determine object type based on probabilities
      let type, mass, color, texture;
      const rand = Math.random();
      
      if (rand < 0.6) {
        // Star
        type = 'star';
        mass = Math.random() * 4 + 1; // 1-5 mass units
        color = new THREE.Color(
          0.5 + Math.random() * 0.5, 
          0.5 + Math.random() * 0.5, 
          0.5 + Math.random() * 0.5
        );
      } else if (rand < 0.9) {
        // Planet
        type = 'planet';
        mass = Math.random() * 0.8 + 0.2; // 0.2-1 mass units
        
        // Random planet colors
        const hue = Math.random() * 360;
        const sat = Math.random() * 50 + 50;
        const light = Math.random() * 30 + 35;
        color = new THREE.Color(`hsl(${hue}, ${sat}%, ${light}%)`);
      } else {
        // Debris
        type = 'debris';
        mass = Math.random() * 0.2 + 0.05; // 0.05-0.25 mass units
        color = new THREE.Color(0.4, 0.4, 0.4);
      }
      
      // Create celestial object
      const object = new CelestialObject({
        type: type,
        mass: mass,
        color: color,
        showTrajectory: false // Disable all trajectories
      });
      
      // Position randomly but avoid the center where the black hole starts
      let x, y, z;
      let distance;
      
      // Add enhanced z variation for stronger 3D effect (-20 to 20)
      z = (Math.random() - 0.5) * 40;
      
      // Create a better distribution of objects across the play area
      const distributionMethod = Math.random();
      
      if (distributionMethod < 0.6) {
        // Random position throughout the play area
        do {
          x = (Math.random() - 0.5) * this.gameWidth * 0.9;
          y = (Math.random() - 0.5) * this.gameHeight * 0.9;
          distance = Math.sqrt(x*x + y*y);
        } while (distance < 10); // Keep away from center
      } else if (distributionMethod < 0.85) {
        // Position in orbital rings around the center
        const ringRadius = 20 + Math.random() * 30; // Different orbital distances
        const angle = Math.random() * Math.PI * 2;
        x = Math.cos(angle) * ringRadius;
        y = Math.sin(angle) * ringRadius;
        
        // Add stronger z variation for 3D orbital plane tilt
        const ringTilt = Math.random() * 0.4; // Increased tilt factor
        z = Math.sin(angle) * ringRadius * ringTilt;
        
        distance = ringRadius;
      } else {
        // Position at the edges (for objects coming into the scene)
        const side = Math.floor(Math.random() * 4);
        switch (side) {
          case 0: // top
            x = (Math.random() - 0.5) * this.gameWidth;
            y = this.gameHeight / 2 * 0.9;
            break;
          case 1: // right
            x = this.gameWidth / 2 * 0.9;
            y = (Math.random() - 0.5) * this.gameHeight;
            break;
          case 2: // bottom
            x = (Math.random() - 0.5) * this.gameWidth;
            y = -this.gameHeight / 2 * 0.9;
            break;
          case 3: // left
            x = -this.gameWidth / 2 * 0.9;
            y = (Math.random() - 0.5) * this.gameHeight;
            break;
        }
        distance = Math.sqrt(x*x + y*y);
      }
      
      object.position.set(x, y, z || 0);
      object.mesh.position.copy(object.position);
      
      // Add more varied velocity for orbital motion
      // Base speed on distance from center for more realistic orbits
      const orbitFactor = 25 / Math.max(10, distance);
      const speed = (0.8 + Math.random() * 1.5) * orbitFactor;
      
      // Direction perpendicular to radius for orbital motion
      const angle = Math.atan2(y, x);
      const orbitalAngle = angle + Math.PI/2; // Perpendicular
      
      // Add some variation to the orbit
      const angleVariation = (Math.random() - 0.5) * 0.5; // Small variations
      
      // Calculate velocity components
      const dx = Math.cos(orbitalAngle + angleVariation) * speed;
      const dy = Math.sin(orbitalAngle + angleVariation) * speed;
      
      // Add some radial velocity component (towards/away from center)
      const radialComponent = (Math.random() - 0.5) * 0.5;
      const radialDx = Math.cos(angle) * radialComponent;
      const radialDy = Math.sin(angle) * radialComponent;
      
      // Add more significant z-component for noticeable vertical movement
      // Larger range for more visible 3D effect
      const dz = (Math.random() - 0.5) * 0.5;
      
      object.velocity = new THREE.Vector3(dx + radialDx, dy + radialDy, dz);
      
      // Add to game
      this.celestialObjects.push(object);
      this.scene.add(object.mesh);
    }
  }
  
  updateVisualEffects() {
    // Update visual effects based on black hole size
    this.blackHole.updateVisuals();
  }
  
  updateScoreAndUI() {
    // Update mass counter
    this.massCounter.textContent = this.blackHole.mass.toFixed(2);
  }
  
  updateTime(deltaTime) {
    if (!this.isRunning) return;
    
    // We're no longer decreasing the time remaining since it's set to Infinity
    // Just update the UI to show a placeholder value
    this.timeRemainingEl.textContent = "∞";
  }
  
  startGame() {
    console.log("Starting game...");
    
    // Prevent multiple startGame calls
    if (this.isRunning) {
      console.log("Game is already running, ignoring startGame call");
      return;
    }
    
    try {
      this.isRunning = true;
      this.startScreen.classList.add('hidden');
      console.log("Creating black hole...");
      this.createBlackHole();
      console.log("Generating objects...");
      this.generateObjects();
      this.lastTime = performance.now();
      console.log("Starting animation loop...");
      this.animate();
      console.log("Game started successfully!");
    } catch (error) {
      console.error("Error starting game:", error);
      // Reset game state if error occurs during startup
      this.isRunning = false;
    }
  }
  
  restartGame() {
    console.log("Restarting game...");
    
    // Prevent restart if game is still running
    if (this.isRunning) {
      console.log("Game is still running, stopping before restart");
    }
    
    // Stop animation loop
    this.isRunning = false;
    
    // Clear any pending animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Remove all celestial objects
    for (let i = this.celestialObjects.length - 1; i >= 0; i--) {
      const object = this.celestialObjects[i];
      
      // Remove trajectory lines if they exist
      if (object.trajectoryLine) {
        this.scene.remove(object.trajectoryLine);
        object.trajectoryLine = null;
      }
      
      // Remove the object's mesh
      if (object.mesh) {
        this.scene.remove(object.mesh);
      }
    }
    
    // Clear the array
    this.celestialObjects = [];
    
    // Clear galaxy clusters array
    if (this.galaxyClusters) {
      this.galaxyClusters = [];
    }
    
    // Remove black hole
    if (this.blackHole) {
      if (this.blackHole.group) {
        this.scene.remove(this.blackHole.group);
      } else if (this.blackHole.mesh) {
        this.scene.remove(this.blackHole.mesh);
      }
      this.blackHole = null;
    }
    
    // Reset game state
    this.timeRemaining = this.gameTimeInSeconds;
    this.gameOverScreen.classList.add('hidden');
    
    // Start new game
    this.startGame();
  }
  
  endGame() {
    // Only end the game if it's currently running
    if (!this.isRunning) return;
    
    console.log("Game ended with black hole mass:", this.blackHole.mass.toFixed(2));
    this.isRunning = false;
    this.finalMassEl.textContent = this.blackHole.mass.toFixed(2);
    this.gameOverScreen.classList.remove('hidden');
    
    // Clear any pending animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  update(deltaTime) {
    // Update black hole position based on mouse
    this.updateBlackHolePosition();
    
    // Update camera animation if active
    this.updateCameraAnimation(deltaTime);
    
    // Update alignment indicator if it exists
    if (this.updateAlignmentIndicator) {
      this.updateAlignmentIndicator(deltaTime);
    }
    
    // If we're using the basic renderer, update it
    if (this.basicRendererActive && this.updateBasicRenderer) {
      this.updateBasicRenderer(deltaTime);
    }
    
    // Debug objects with no velocity
    if (this.frameCount % 60 === 0 && this.celestialObjects.length > 0) {
      let stuckObjects = this.celestialObjects.filter(obj => 
        obj.velocity.lengthSq() < 0.1 && 
        !obj.isAbsorbed
      );
      
      if (stuckObjects.length > 0) {
        console.log(`Found ${stuckObjects.length} objects with almost no velocity`);
        
        // Fix stuck objects by giving them a small push toward the black hole
        stuckObjects.forEach(obj => {
          if (this.blackHole) {
            const direction = new THREE.Vector3().subVectors(this.blackHole.position, obj.position).normalize();
            // Add a stronger impulse to get objects moving
            obj.velocity.add(direction.multiplyScalar(1.5));
            
            // Add a slight perpendicular component for orbital motion
            const perpDirection = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
            obj.velocity.add(perpDirection.multiplyScalar(0.8));
            
            console.log(`Added velocity to stuck ${obj.type}, new velocity:`, obj.velocity);
          }
        });
      }
    }
    
    // Check for and fix objects that are too far away but still in the scene
    if (this.frameCount % 120 === 0 && this.celestialObjects.length > 0) {
      const maxDistance = this.gameWidth * 0.8;
      const distantObjects = this.celestialObjects.filter(obj => 
        obj.position.distanceTo(new THREE.Vector3(0, 0, 0)) > maxDistance && 
        !obj.isAbsorbed &&
        obj.velocity.lengthSq() < 0.5 // Only consider slowly moving distant objects
      );
      
      if (distantObjects.length > 0) {
        // Reposition and give new velocity to these objects
        distantObjects.forEach(obj => {
          // Move them closer to the game area
          const dirToCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), obj.position).normalize();
          obj.position.add(dirToCenter.multiplyScalar(maxDistance * 0.3));
          
          // Give them new orbital velocity
          const speed = 1.5 + Math.random() * 2;
          const perpDirection = new THREE.Vector3(-dirToCenter.y, dirToCenter.x, 0).normalize();
          obj.velocity = perpDirection.multiplyScalar(speed);
          
          // Update mesh position
          obj.mesh.position.copy(obj.position);
          
          // Update trajectory
          if (obj.trajectoryLine && this.blackHole) {
            obj.updateTrajectoryLine(this.blackHole);
          }
        });
      }
    }
    
    // Update physics and game logic
    if (this.blackHole && this.isRunning) {
      // Update black hole (this will check for absorptions)
      this.blackHole.update(deltaTime, this.celestialObjects);
      
      // Update galaxy clusters if they exist
      if (this.galaxyClusters && this.galaxyClusters.length > 0) {
        for (let i = 0; i < this.galaxyClusters.length; i++) {
          // We don't need to update the cluster objects' physics here as they're already in the celestialObjects array
          // Just update any cluster-specific properties if needed in future
        }
      }
      
      // Update celestial objects
      for (let i = this.celestialObjects.length - 1; i >= 0; i--) {
        const object = this.celestialObjects[i];
        
        // Check if object was absorbed
        if (object.isAbsorbed) {
          // Remove trajectory line if it exists
          if (object.trajectoryLine) {
            this.scene.remove(object.trajectoryLine);
            object.trajectoryLine = null;
          }
          
          // Remove from scene and array
          this.scene.remove(object.mesh);
          this.celestialObjects.splice(i, 1);
          continue;
        }
        
        // Check if object is too far away, remove it to save resources
        if (object.position.lengthSq() > this.gameWidth * this.gameWidth * 2) {
          if (object.trajectoryLine) {
            this.scene.remove(object.trajectoryLine);
          }
          this.scene.remove(object.mesh);
          this.celestialObjects.splice(i, 1);
          continue;
        }
        
        // Update object position based on gravitational pull
        object.update(deltaTime, this.blackHole, this.celestialObjects);
        
        // Update trajectory line if it exists
        if (object.trajectoryLine && !object.isAbsorbed && this.blackHole) {
          try {
            object.updateTrajectoryLine(this.blackHole);
          } catch (error) {
            console.warn(`Error updating trajectory for object ${i}:`, error);
            // Remove problematic trajectory line
            this.scene.remove(object.trajectoryLine);
            object.trajectoryLine = null;
          }
        }
      }
      
      // Check if we need to generate more objects
      // Increased threshold to add more objects sooner
      if (this.celestialObjects.length < 25) {
        // Calculate how many objects to add based on how far below threshold
        const deficit = 25 - this.celestialObjects.length;
        const objectsToAdd = Math.min(15, Math.max(5, deficit));
        
        // Add more celestial objects to maintain a good density
        this.addMoreCelestialObjects(objectsToAdd);
      }
      
      // Periodically add some objects to maintain visual interest, even if we're above the threshold
      if (this.frameCount % 300 === 0) {
        this.addMoreCelestialObjects(3);
        
        // Occasionally add a new galaxy cluster
        if (Math.random() < 0.3 && (!this.galaxyClusters || this.galaxyClusters.length < 3)) {
          // Position cluster at a random edge
          const clusterDistance = Math.max(this.gameWidth, this.gameHeight) * 0.4;
          const angle = Math.random() * Math.PI * 2;
          const clusterX = Math.cos(angle) * clusterDistance;
          const clusterY = Math.sin(angle) * clusterDistance;
          
          // Create random cluster
          const clusterTypes = ['standard', 'binary', 'dense', 'sparse'];
          const clusterSizes = ['small', 'medium'];
          const clusterType = clusterTypes[Math.floor(Math.random() * clusterTypes.length)];
          const clusterSize = clusterSizes[Math.floor(Math.random() * clusterSizes.length)];
          
          const cluster = new GalaxyCluster({
            position: new THREE.Vector3(clusterX, clusterY, 0),
            type: clusterType,
            size: clusterSize,
            scene: this.scene
          });
          
          // Add objects to game
          const clusterObjects = cluster.getAllObjects();
          for (const obj of clusterObjects) {
            this.celestialObjects.push(obj);
            if (!obj.mesh.parent) {
              this.scene.add(obj.mesh);
            }
          }
          
          // Store the cluster
          if (!this.galaxyClusters) this.galaxyClusters = [];
          this.galaxyClusters.push(cluster);
        }
      }
    }
    
    this.updateTime(deltaTime);
  }
  
  addMoreCelestialObjects(count) {
    console.log(`Adding ${count} new celestial objects`);
    
    // Generate additional objects when the count gets low
    for (let i = 0; i < count; i++) {
      // Determine object type based on probabilities
      let type, mass, color;
      const rand = Math.random();
      
      // Changed probabilities to ensure more stars
      if (rand < 0.4) {
        // Star
        type = 'star';
        mass = Math.random() * 4 + 1; // 1-5 mass units
        color = new THREE.Color(
          0.5 + Math.random() * 0.5, 
          0.5 + Math.random() * 0.5, 
          0.5 + Math.random() * 0.5
        );
      } else if (rand < 0.9) {
        // Planet
        type = 'planet';
        mass = Math.random() * 0.8 + 0.2; // 0.2-1 mass units
        
        // Random planet colors
        const hue = Math.random() * 360;
        const sat = Math.random() * 50 + 50;
        const light = Math.random() * 30 + 35;
        color = new THREE.Color(`hsl(${hue}, ${sat}%, ${light}%)`);
      } else {
        // Debris
        type = 'debris';
        mass = Math.random() * 0.2 + 0.05; // 0.05-0.25 mass units
        color = new THREE.Color(0.4, 0.4, 0.4);
      }
      
      // Create celestial object
      const object = new CelestialObject({
        type: type,
        mass: mass,
        color: color,
        showTrajectory: false // Disable all trajectories
      });
      
      // For planets, check if we should assign them to stars
      if (type === 'planet' && Math.random() < 0.7) { // 70% chance of creating an orbiting planet
        // Find a suitable star to orbit around
        const stars = this.celestialObjects.filter(obj => 
          obj.type === 'star' && 
          obj.parent === null && // Only use stars that aren't already orbiting something
          obj.position.distanceTo(this.blackHole.position) > this.blackHole.getRadius() * 8 // Only stars far enough from the black hole
        );
        
        if (stars.length > 0) {
          // Choose a random star
          const parentStar = stars[Math.floor(Math.random() * stars.length)];
          
          // Set the parent and calculate orbit
          object.parent = parentStar;
          
          // Random orbit distance from the star (scaled by star mass)
          const orbitDistance = (1.5 + Math.random() * 2) * parentStar.getRadius() * 3;
          
          // Random initial angle
          const angle = Math.random() * Math.PI * 2;
          
          // Position the planet in orbit around the star
          object.position.set(
            parentStar.position.x + Math.cos(angle) * orbitDistance,
            parentStar.position.y + Math.sin(angle) * orbitDistance,
            parentStar.position.z + (Math.random() - 0.5) * 2 // Small z-variation
          );
          
          // Calculate orbital velocity based on parent star's mass
          const orbitSpeed = Math.sqrt(0.3 * parentStar.mass / orbitDistance);
          
          // Set velocity perpendicular to the radius vector for circular orbit
          const perpAngle = angle + Math.PI / 2;
          object.velocity = new THREE.Vector3(
            Math.cos(perpAngle) * orbitSpeed,
            Math.sin(perpAngle) * orbitSpeed,
            (Math.random() - 0.5) * 0.1 // Small z-component
          );
          
          // Set mesh position
          object.mesh.position.copy(object.position);
          
          // Add to game
          this.celestialObjects.push(object);
          this.scene.add(object.mesh);
          
          continue; // Skip the normal positioning code below
        }
      }
      
      // Standard positioning for non-orbiting objects
      // Position randomly on the edges with more variation
      const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      const distanceVariation = 0.2; // Allow objects to appear deeper into the play area
      let x, y, z;
      
      // Add enhanced z-depth for more pronounced 3D effect (-20 to 20)
      z = (Math.random() - 0.5) * 40;
      
      switch (side) {
        case 0: // top
          x = (Math.random() - 0.5) * this.gameWidth;
          y = this.gameHeight / 2 * (1 - Math.random() * distanceVariation);
          break;
        case 1: // right
          x = this.gameWidth / 2 * (1 - Math.random() * distanceVariation);
          y = (Math.random() - 0.5) * this.gameHeight;
          break;
        case 2: // bottom
          x = (Math.random() - 0.5) * this.gameWidth;
          y = -this.gameHeight / 2 * (1 - Math.random() * distanceVariation);
          break;
        case 3: // left
          x = -this.gameWidth / 2 * (1 - Math.random() * distanceVariation);
          y = (Math.random() - 0.5) * this.gameHeight;
          break;
      }
      
      object.position.set(x, y, z);
      object.mesh.position.copy(object.position);
      
      // More varied velocity for objects
      const centerAngle = Math.atan2(-y, -x);
      // Increase angle variation for more interesting trajectories
      const angleVariation = (Math.random() - 0.5) * Math.PI / 2; // +/- 45 degrees
      // Vary speeds more to create different orbits
      const speed = 0.8 + Math.random() * 2.2;
      
      const dx = Math.cos(centerAngle + angleVariation) * speed;
      const dy = Math.sin(centerAngle + angleVariation) * speed;
      
      // Add more significant z velocity component for noticeable 3D movement
      // Increased magnitude for more visible effect
      const dz = (Math.random() - 0.5) * 0.3;
      
      object.velocity = new THREE.Vector3(dx, dy, dz);
      
      // Add small perpendicular velocity for more orbital trajectories
      if (Math.random() < 0.7) { // 70% chance for orbital component
        const perpAngle = centerAngle + Math.PI/2;
        const perpSpeed = 0.3 + Math.random() * 1.0;
        object.velocity.x += Math.cos(perpAngle) * perpSpeed;
        object.velocity.y += Math.sin(perpAngle) * perpSpeed;
      }
      
      // Add to game
      this.celestialObjects.push(object);
      this.scene.add(object.mesh);
    }
  }
  
  onWindowResize() {
    const aspectRatio = window.innerWidth / window.innerHeight;
    
    // Update for perspective camera
    this.camera.aspect = aspectRatio;
    
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update composer size if it exists
    if (this.composer) {
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Update lens effect if it exists
    if (this.lensEffect) {
      this.lensEffect.onResize();
    }
  }
  
  animate() {
    if (!this.isRunning) return;
    
    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;
    
    // Animation frame
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    
    // Increase frame counter
    this.frameCount++;
    
    // Add debug info less frequently to avoid console spam
    if (this.frameCount % 180 === 0) {
      console.log(`Frame: ${this.frameCount}, Objects: ${this.celestialObjects.length}, BlackHole: ${this.blackHole?.mass.toFixed(2)}`);
    }
    
    // 1. First update camera controls via interaction system
    // This should happen before any game logic updates
    if (this.interaction) {
      this.interaction.update(deltaTime);
    }
    
    // 2. Call the empty updateCameraAnimation function (disabled but maintained for reference consistency)
    this.updateCameraAnimation(deltaTime);
    
    // 3. Then update gameplay elements
    this.update(deltaTime);
    
    // CRITICAL: Simplified rendering logic to ensure we see something
    try {
      // Update lens effect with the latest black hole properties if available
      if (this.blackHole && this.lensEffect && !this.lensEffect.fallbackActive) {
        // Get the black hole's screen position and other properties
        const blackHoleProps = this.blackHole.getLensEffectProperties();
        
        // Update the lens effect with the latest black hole properties
        this.lensEffect.update(blackHoleProps.position, blackHoleProps.radius);
        
        // Let lens effect handle rendering with post-processing
        this.lensEffect.render();
      } else if (this.composer && typeof this.composer.render === 'function') {
        // Use composer directly if lens effect not available (uses our bloom effect)
        this.composer.render();
      } else {
        // Use standard renderer as fallback
        this.renderer.render(this.scene, this.camera);
      }
    } catch (renderError) {
      console.error("Render error, falling back to standard renderer:", renderError.message);
      try {
        // Last resort - standard rendering
        this.renderer.render(this.scene, this.camera);
      } catch (e) {
        console.error("Critical rendering failure!");
      }
    }
  }

  // Add a method to create a basic black hole visualization without post-processing
  setupBasicRenderer() {
    console.log("Setting up basic renderer fallback");
    
    // If we already have a working renderer, don't replace it
    if (this.basicRendererActive) {
      return;
    }
    
    // Mark that we're using the basic renderer
    this.basicRendererActive = true;
    
    // Ensure we can see the black hole even without post-processing
    if (this.blackHole) {
      console.log("Setting up basic black hole visualization");
      
      // First clean up any existing effects that might be in the scene
      if (this.blackHoleGlow && this.scene.children.includes(this.blackHoleGlow)) {
        this.scene.remove(this.blackHoleGlow);
        this.blackHoleGlow = null;
      }
      
      if (this.accretionDisk && this.scene.children.includes(this.accretionDisk)) {
        this.scene.remove(this.accretionDisk);
        this.accretionDisk = null;
      }
      
      // Check if event horizon exists and has material
      if (this.blackHole.eventHorizon && this.blackHole.eventHorizon.material) {
        // Make sure the black hole's event horizon is visible but still partially transparent
        this.blackHole.eventHorizon.material.opacity = 0.85;
      }
      
      // Create a simple glow effect if it doesn't exist yet
      if (!this.blackHoleGlow) {
        // Create glow that's attached to the black hole group
        const glowGeometry = new THREE.SphereGeometry(this.blackHole.getRadius() * 2.8, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: 0x220066, // More vibrant purple
          transparent: true,
          opacity: 0.4,
          side: THREE.BackSide,
          depthWrite: false // Important for proper blending
        });
        
        this.blackHoleGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        
        // Always add to the group for proper transform inheritance
        if (this.blackHole.group) {
          // Add with zero local position since group already has the proper position
          this.blackHoleGlow.position.set(0, 0, 0);
          this.blackHole.group.add(this.blackHoleGlow);
          console.log("Added blackhole glow effect to black hole group");
        } else {
          // Fallback to scene placement if no group exists
          this.blackHoleGlow.position.copy(this.blackHole.position);
          this.scene.add(this.blackHoleGlow);
          console.log("Added blackhole glow effect to scene");
        }
      }
      
      // Create accretion disk with better shader for lens effect integration
      const diskGeometry = new THREE.RingGeometry(
        this.blackHole.getRadius() * 2.1,
        this.blackHole.getRadius() * 3.2,
        48, 
        2
      );
      
      // Use a shader material for better visual integration with lens effect
      const diskMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          radius: { value: this.blackHole.getRadius() },
          color: { value: new THREE.Color(0x304080) }, // More vibrant blue
          opacity: { value: 0.5 }
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
          uniform float radius;
          uniform vec3 color;
          uniform float opacity;
          
          varying vec2 vUv;
          
          void main() {
            // Calculate distance from center and angle for disk effect
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(vUv, center) * 2.0;
            float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
            
            // Create a feathered inner and outer edge
            float innerEdge = smoothstep(0.0, 0.3, dist - 0.5);
            float outerEdge = smoothstep(1.0, 0.7, dist);
            
            // Combine edges for disk shape
            float diskShape = innerEdge * outerEdge;
            
            // Add subtle rotation and variation
            float rotation = sin(angle * 3.0 + time * 0.2) * 0.2 + 0.8;
            
            // Apply the final color with feathered edges
            vec3 finalColor = color * rotation;
            float alpha = diskShape * opacity;
            
            gl_FragColor = vec4(finalColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      
      this.accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
      
      // Always add to the group for proper transform inheritance
      if (this.blackHole.group) {
        // Set the rotation before adding to the group
        this.accretionDisk.rotation.x = Math.PI / 2;
        this.accretionDisk.position.set(0, 0, 0); // Local position is zero
        this.blackHole.group.add(this.accretionDisk);
        console.log("Added accretion disk to black hole group");
      } else {
        // Fallback to scene placement if no group exists
        this.accretionDisk.position.copy(this.blackHole.position);
        this.accretionDisk.rotation.x = Math.PI / 2;
        this.scene.add(this.accretionDisk);
        console.log("Added accretion disk to scene");
      }
      
      // Adding a simple update function for the glow and disk
      this.updateBasicRenderer = (deltaTime) => {
        const time = performance.now() * 0.001; // Current time in seconds
        
        // Only need to maintain manual positioning if objects aren't in the group
        if (this.blackHoleGlow && !this.blackHole.group.children.includes(this.blackHoleGlow)) {
          this.blackHoleGlow.position.copy(this.blackHole.position);
          // Scale with mass for visual growth
          const glowScale = 1.0 + this.blackHole.mass * 0.1;
          this.blackHoleGlow.scale.set(glowScale, glowScale, glowScale);
        }
        
        // Only need to maintain manual positioning if objects aren't in the group
        if (this.accretionDisk && !this.blackHole.group.children.includes(this.accretionDisk)) {
          this.accretionDisk.position.copy(this.blackHole.position);
        }
        
        // Always update rotation for spinning effect, regardless of parent
        if (this.accretionDisk) {
          this.accretionDisk.rotation.z += deltaTime * 0.2;
          
          // Update time in the shader
          if (this.accretionDisk.material && this.accretionDisk.material.uniforms) {
            this.accretionDisk.material.uniforms.time.value = time;
          }
        }
      };
      
      console.log("Basic black hole visualization complete");
    }
  }
}

// Make Game class globally available
window.Game = Game;

// Create game instance
window.game = new Game();

// Make window.startGame globally accessible
window.startGame = function() {
  console.log("Global startGame function called from window object");
  if (window.game) {
    window.game.startGame();
  } else {
    console.log("Creating new game instance...");
    window.game = new Game();
    window.game.startGame();
  }
};

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded, initializing game");
  
  // Create game instance
  window.game = new Game();
  console.log("Game instance created");
  
  // CRITICAL: Find and fix the start button
  const startButton = document.getElementById('start-button');
  if (startButton) {
    console.log("Found start button, removing any existing onclick attribute");
    
    // Remove any existing onclick attribute if present (might be causing issues)
    startButton.removeAttribute('onclick');
    
    // Remove any existing event listeners (just to be safe)
    startButton.replaceWith(startButton.cloneNode(true));
    
    // Get fresh reference after replacement
    const freshStartButton = document.getElementById('start-button');
    
    // Add our event listener
    freshStartButton.addEventListener('click', function() {
      console.log("Start button clicked via event listener");
      if (window.game) {
        window.game.startGame();
      } else {
        console.error("Game instance not found!");
        // Attempt to create the game if it doesn't exist
        window.game = new Game();
        window.game.startGame();
      }
    });
    
    console.log("Start button event listener attached");
  } else {
    console.error("Start button not found in DOM!");
  }
  
  // Debug output
  console.log("Start Button HTML:", document.getElementById('start-button')?.outerHTML);
  console.log("Window.startGame is:", typeof window.startGame);
  console.log("Window.game is:", window.game ? "initialized" : "not initialized");
  
  // Add a global click handler for debugging
  document.addEventListener('click', (e) => {
    console.log('Click event on:', e.target);
  });
}); 