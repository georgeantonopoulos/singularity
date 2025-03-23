import { THREE, OrbitControls } from './libs/three-setup.js';
import { BlackHole } from './entities/BlackHole.js';
import { CelestialObject } from './entities/CelestialObject.js';
import { generateCelestialObjects } from './utils/objectGenerator.js';
import { setupLighting } from './utils/lighting.js';
import { createStarfield } from './utils/starfield.js';
import { lensPostProcessingVertexShader, lensPostProcessingFragmentShader } from './shaders/blackHoleShaders.js';
import { BlackHoleLensEffect } from './libs/BlackHoleLensEffect.js';

// At the top of the file, after imports
console.log("Main.js loaded with ES6 modules");

// =============================================
// IMPORTANT: Make window.startGame globally accessible
// This is needed because we're using ES modules which don't expose variables to window by default
// =============================================
window.startGame = function() {
  console.log("Global startGame function called from window object");
  if (window.game) {
    window.game.startGame();
  } else {
    console.error("Game instance not found!");
  }
};

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
    
    // Initialize the game
    this.setupEventListeners();
    this.initThree();
    console.log("Game constructor completed");
  }

  setupEventListeners() {
    console.log("Setting up event listeners");
    
    if (!this.startButton) {
      console.error("Start button not found in the DOM!");
      this.startButton = document.getElementById('start-button');
      console.log("Retry getting start button:", this.startButton);
    }
    
    // Direct click handler function for debugging
    const handleStartClick = () => {
      console.log("Start button clicked!");
      this.startGame();
    };
    
    // Make sure to remove any existing listeners first
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
    
    // Changed: Use click instead of mousemove for black hole movement
    this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    
    // Add mousemove just to track position for visual feedback
    this.canvas.addEventListener('mousemove', (e) => {
      // Update mouse position but don't move black hole
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }
  
  onCanvasClick(event) {
    if (!this.isRunning) return;
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Convert to world coordinates
    const worldPos = new THREE.Vector3(x, y, 0);
    worldPos.unproject(this.camera);
    
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
      // Calculate distance to target
      const distance = this.blackHole.position.distanceTo(this.targetPosition);
      
      // Only update if we're not already very close
      if (distance > 0.01) {
        this.blackHole.position.lerp(this.targetPosition, this.lerpFactor);
        this.blackHole.mesh.position.copy(this.blackHole.position);
      }
    }
  }

  initThree() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000511); // Dark blue background
    
    // Create camera - use orthographic for 2D view
    const aspectRatio = window.innerWidth / window.innerHeight;
    const frustumSize = 60;
    this.camera = new THREE.OrthographicCamera(
      frustumSize * aspectRatio / -2,
      frustumSize * aspectRatio / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    this.camera.position.z = 100;
    this.camera.lookAt(0, 0, 0);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Create starfield background - now just on a plane for 2D effect
    this.createStarfield();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Add directional light for subtle shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);
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
        console.log("Post-processing lens effect initialized successfully");
      } else {
        console.warn("Could not initialize post-processing lens effect, using fallback visuals");
        this.setupBasicRenderer();
      }
    } catch (error) {
      console.error("Error initializing lens effect:", error);
      // Lens effect initialization failed, use the fallback
      this.setupBasicRenderer();
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
    // Create a starfield background on a plane
    const starfieldGeometry = new THREE.PlaneGeometry(this.gameWidth*3, this.gameHeight*3);
    
    // Create a canvas for the starfield
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    
    // Fill with darker, more physically accurate gradient
    const gradient = ctx.createRadialGradient(
      canvas.width/2, canvas.height/2, 0,
      canvas.width/2, canvas.height/2, canvas.width/2
    );
    
    // Use darker, more accurate space colors
    gradient.addColorStop(0, 'rgba(8, 12, 24, 1)');    // Dark blue-black at center
    gradient.addColorStop(0.4, 'rgba(6, 10, 22, 1)');  // Slightly lighter
    gradient.addColorStop(0.8, 'rgba(4, 8, 18, 1)');   // Even darker
    gradient.addColorStop(1, 'rgba(2, 4, 12, 1)');     // Nearly black at edges
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle nebula effect
    this.addNebulaeToStarfield(ctx, canvas.width, canvas.height);
    
    // Add stars with realistic distribution (Gaussian clusters)
    this.addRealisticStarDistribution(ctx, canvas.width, canvas.height);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create material with the texture
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    });
    
    // Create mesh and add to scene
    const starfieldMesh = new THREE.Mesh(starfieldGeometry, material);
    starfieldMesh.position.z = -10; // Behind everything
    this.scene.add(starfieldMesh);
  }
  
  // Add nebula clouds to make the starfield more interesting
  addNebulaeToStarfield(ctx, width, height) {
    // Add subtle nebulae/gas clouds
    const nebulaCount = 6;
    
    for (let i = 0; i < nebulaCount; i++) {
      // Random position
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * width * 0.5 + width * 0.2;
      
      // Create nebula gradient
      const nebulaGradient = ctx.createRadialGradient(
        x, y, 0,
        x, y, size
      );
      
      // Choose nebula color scheme
      const colorScheme = Math.floor(Math.random() * 4);
      let colors;
      
      switch (colorScheme) {
        case 0: // Blue nebula
          colors = [
            'rgba(30, 60, 120, 0.06)',
            'rgba(20, 40, 100, 0.04)',
            'rgba(15, 30, 80, 0.02)',
            'rgba(0, 0, 0, 0)'
          ];
          break;
        case 1: // Reddish nebula
          colors = [
            'rgba(120, 30, 40, 0.05)',
            'rgba(100, 20, 30, 0.04)',
            'rgba(80, 15, 20, 0.02)',
            'rgba(0, 0, 0, 0)'
          ];
          break;
        case 2: // Purple nebula
          colors = [
            'rgba(80, 30, 120, 0.05)',
            'rgba(60, 20, 100, 0.04)',
            'rgba(40, 15, 80, 0.02)',
            'rgba(0, 0, 0, 0)'
          ];
          break;
        default: // Greenish nebula (more rare)
          colors = [
            'rgba(30, 100, 60, 0.04)',
            'rgba(20, 80, 40, 0.03)',
            'rgba(15, 60, 30, 0.02)',
            'rgba(0, 0, 0, 0)'
          ];
      }
      
      // Apply color stops
      nebulaGradient.addColorStop(0, colors[0]);
      nebulaGradient.addColorStop(0.3, colors[1]);
      nebulaGradient.addColorStop(0.6, colors[2]);
      nebulaGradient.addColorStop(1, colors[3]);
      
      // Draw nebula
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = nebulaGradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Add some texture/noise to the nebula
      this.addNebulaTexture(ctx, x, y, size);
    }
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  }
  
  // Add texture to nebula
  addNebulaTexture(ctx, x, y, size) {
    // Add noise/texture to the nebula
    const noisePoints = Math.floor(size / 5);
    
    ctx.globalCompositeOperation = 'screen';
    
    for (let i = 0; i < noisePoints; i++) {
      // Random position within nebula
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * size * 0.8;
      const noiseX = x + Math.cos(angle) * distance;
      const noiseY = y + Math.sin(angle) * distance;
      
      // Random noise size
      const noiseSize = Math.random() * 8 + 4;
      
      // Create noise gradient
      const noiseGradient = ctx.createRadialGradient(
        noiseX, noiseY, 0,
        noiseX, noiseY, noiseSize
      );
      
      // Randomize opacity based on distance from center
      const opacity = 0.05 * (1 - distance/size);
      
      noiseGradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
      noiseGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      // Draw noise point
      ctx.fillStyle = noiseGradient;
      ctx.beginPath();
      ctx.arc(noiseX, noiseY, noiseSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Create more realistic star distribution
  addRealisticStarDistribution(ctx, width, height) {
    // Reset composite operation
    ctx.globalCompositeOperation = 'lighter';
    
    // Create star clusters (Gaussian distribution)
    const clusterCount = 8;
    const totalStars = 2000;
    
    // Function to generate gaussian random value
    const gaussianRandom = () => {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };
    
    // Create clusters of stars
    for (let c = 0; c < clusterCount; c++) {
      // Cluster center
      const centerX = Math.random() * width;
      const centerY = Math.random() * height;
      
      // Cluster spread
      const spreadX = width * (0.1 + Math.random() * 0.2);
      const spreadY = height * (0.1 + Math.random() * 0.2);
      
      // Stars per cluster
      const clusterStars = Math.floor(totalStars / clusterCount);
      
      for (let i = 0; i < clusterStars; i++) {
        // Use gaussian distribution for natural cluster appearance
        const x = centerX + gaussianRandom() * spreadX;
        const y = centerY + gaussianRandom() * spreadY;
        
        // Skip if outside canvas
        if (x < 0 || x > width || y < 0 || y > height) continue;
        
        // Realistic star brightness distribution (most stars are dim, few are bright)
        // Use power law distribution
        const brightness = Math.pow(Math.random(), 3); // More small values
        const radius = brightness * 1.5 + 0.2;
        const opacity = brightness * 0.8 + 0.2;
        
        // Star color based on temperature (spectral class)
        // Realistic distribution of star colors
        const colorRoll = Math.random();
        let starColor;
        
        if (colorRoll < 0.01) {
          // O and B class (rare, very blue/white)
          starColor = `rgba(200, 220, 255, ${opacity})`;
        } else if (colorRoll < 0.1) {
          // A class (white)
          starColor = `rgba(240, 240, 255, ${opacity})`;
        } else if (colorRoll < 0.3) {
          // F class (yellowish white)
          starColor = `rgba(255, 255, 240, ${opacity})`;
        } else if (colorRoll < 0.6) {
          // G class (yellow, like our sun)
          starColor = `rgba(255, 255, 210, ${opacity})`;
        } else if (colorRoll < 0.85) {
          // K class (orange)
          starColor = `rgba(255, 230, 180, ${opacity})`;
        } else {
          // M class (red)
          starColor = `rgba(255, 200, 180, ${opacity})`;
        }
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = starColor;
        ctx.fill();
        
        // Add glow to brighter stars
        if (radius > 1) {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
          glow.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.3})`);
          glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.beginPath();
          ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
          
          // Add diffraction spikes to the brightest stars
          if (radius > 1.2) {
            this.addDiffractionSpikes(ctx, x, y, radius, opacity);
          }
        }
      }
    }
    
    // Add a few very bright stars across the entire field
    const brightStarCount = 15;
    for (let i = 0; i < brightStarCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = 1.5 + Math.random() * 2;
      const opacity = 0.8 + Math.random() * 0.2;
      
      // Brighter star with a stronger glow
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fill();
      
      // Add bigger glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 6);
      glow.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.4})`);
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.beginPath();
      ctx.arc(x, y, radius * 6, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      
      // Add diffraction spikes
      this.addDiffractionSpikes(ctx, x, y, radius, opacity);
    }
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  }
  
  // Add diffraction spikes to bright stars
  addDiffractionSpikes(ctx, x, y, radius, opacity) {
    // Number of spikes (usually 4 for telescopes)
    const spikeCount = 4;
    const spikeLength = radius * (8 + Math.random() * 6);
    
    ctx.save();
    ctx.translate(x, y);
    
    // Create spikes
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i * Math.PI) / (spikeCount / 2);
      
      ctx.save();
      ctx.rotate(angle);
      
      // Create gradient for spike
      const gradient = ctx.createLinearGradient(0, 0, spikeLength, 0);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.7})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      // Draw spike
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(spikeLength, 0);
      ctx.lineWidth = radius * 0.4;
      ctx.strokeStyle = gradient;
      ctx.stroke();
      
      ctx.restore();
    }
    
    ctx.restore();
  }
  
  createBlackHole() {
    // Clean up any existing black hole first
    if (this.blackHole && this.blackHole.mesh) {
      this.scene.remove(this.blackHole.mesh);
      this.blackHole = null;
    }
    
    // If there's an existing glow effect, remove it
    if (this.blackHoleGlow) {
      this.scene.remove(this.blackHoleGlow);
      this.blackHoleGlow = null;
    }
    
    this.blackHole = new BlackHole({
      initialMass: 1,
      eventHorizonVisuals: true,
      gravitationalLensingEffect: 0.5,
      camera: this.camera  // Pass the camera reference to the black hole
    });
    
    this.blackHole.onObjectAbsorbed = (object) => {
      this.blackHole.increaseMass(object.mass * 0.2); // Add 20% of object's mass
      this.updateVisualEffects();
      this.updateScoreAndUI();
      
      // Add absorption visual effect
      this.createAbsorptionEffect(object.position);
    };
    
    // Position the black hole at center initially
    this.blackHole.position = new THREE.Vector3(0, 0, 0);
    this.blackHole.mesh.position.copy(this.blackHole.position);
    
    // Ensure black hole is visible with proper 3D appearance
    this.blackHole.mesh.scale.set(3, 3, 3); // Make it bigger
    
    // Add the black hole to the scene
    this.scene.add(this.blackHole.mesh);
    
    // Set up lens effect - this is now using a fallback renderer
    this.setupLensEffect();
  }
  
  createAbsorptionEffect(position) {
    // Create stretched geometries pointing toward black hole
    const dirToBlackHole = new THREE.Vector3()
      .subVectors(this.blackHole.position, position)
      .normalize();
    
    // Distance to black hole
    const distToBH = this.blackHole.position.distanceTo(position);
    
    // Add shock wave effect when objects are absorbed
    this.createShockWave(position);
    
    // Create accretion disk brightening effect - much more subtle now
    const flashGeometry = new THREE.RingGeometry(
      this.blackHole.getRadius() * 1.2,
      this.blackHole.getRadius() * 2,
      32, 
      2
    );
    
    // Material that brightens the accretion disk - with less yellow, more blue/white
    const flashMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.2 }, // Significantly reduced intensity
        color: { value: new THREE.Color(0x8080BB) } // Changed to a subtle blue-gray
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
    diskFlash.position.copy(this.blackHole.position);
    diskFlash.position.z = 0.2;
    this.scene.add(diskFlash);
    
    // Create light spikes coming out of the black hole perpendicular to the accretion disk
    // These represent relativistic jets often seen in real black holes - made more subtle
    const jetGeometry = new THREE.ConeGeometry(0.3, distToBH * 0.2, 16, 1, true);
    const jetMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x5050AA) } // Less bright blue
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
    jet1.rotation.z = Math.PI/2;
    jet1.scale.set(1, 1 + Math.random(), 1);
    this.scene.add(jet1);
    
    const jet2 = new THREE.Mesh(jetGeometry, jetMaterial.clone());
    jet2.position.copy(this.blackHole.position);
    jet2.rotation.z = -Math.PI/2;
    jet2.scale.set(1, 1 + Math.random(), 1);
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
      
      // Fade out jets
      jet1.material.opacity = Math.max(0, 0.5 - elapsed * 0.5); // Start at 50% opacity and fade quicker
      jet2.material.opacity = Math.max(0, 0.5 - elapsed * 0.5); // Start at 50% opacity and fade quicker
      
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
    // Create shockwave ring geometry - even smaller now
    const radius = 1.2;
    const segments = 32;
    const geometry = new THREE.RingGeometry(radius * 0.9, radius, segments);
    
    // Create shockwave material with custom shader - more subtle
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xDDDDDD) }, // Less bright white
        intensity: { value: 0.3 }, // Further reduced intensity
        center: { value: new THREE.Vector2(0, 0) }
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
          // Create a pulse effect - more subtle
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
    shockwave.position.z = 0.1; // Just above the scene plane but below post-processing
    shockwave.rotation.z = Math.random() * Math.PI * 2; // Random rotation for variety
    
    // Add to scene
    this.scene.add(shockwave);
    
    // Animate the shockwave - shorter and smaller
    const startTime = performance.now();
    const duration = 0.6; // Even shorter duration
    const maxScale = 6; // Smaller max scale
    
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
      
      // Update shader uniforms - fade faster
      material.uniforms.time.value = progress;
      material.uniforms.intensity.value = 0.3 * (1 - easeOutProgress); // Start lower and fade out
      
      // Request next frame
      requestAnimationFrame(updateShockwave);
    };
    
    // Start animation
    updateShockwave();
  }
  
  generateObjects() {
    // Generate celestial objects in 2D plane
    this.celestialObjects = [];
    
    // Number of objects to generate - increased for a fuller game field
    const objectCount = 70;
    
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
      let x, y;
      let distance;
      
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
      
      object.position.set(x, y, 0);
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
      
      object.velocity = new THREE.Vector3(dx + radialDx, dy + radialDy, 0);
      
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
    
    // Remove black hole
    if (this.blackHole) {
      if (this.blackHole.mesh) {
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
        object.update(deltaTime, this.blackHole);
        
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
      
      // Improved positioning strategy for new objects
      // Position randomly on the edges with more variation
      const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      const distanceVariation = 0.2; // Allow objects to appear deeper into the play area
      let x, y;
      
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
      
      object.position.set(x, y, 0);
      object.mesh.position.copy(object.position);
      
      // More varied velocity for objects
      const centerAngle = Math.atan2(-y, -x);
      // Increase angle variation for more interesting trajectories
      const angleVariation = (Math.random() - 0.5) * Math.PI / 2; // +/- 45 degrees
      // Vary speeds more to create different orbits
      const speed = 0.8 + Math.random() * 2.2;
      
      const dx = Math.cos(centerAngle + angleVariation) * speed;
      const dy = Math.sin(centerAngle + angleVariation) * speed;
      
      object.velocity = new THREE.Vector3(dx, dy, 0);
      
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
    const frustumSize = 60;
    
    this.camera.left = frustumSize * aspectRatio / -2;
    this.camera.right = frustumSize * aspectRatio / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;
    
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
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
    
    // Update game logic
    this.update(deltaTime);
    
    // CRITICAL: Simplified rendering logic to ensure we see something
    try {
      // Check if we can use the lens effect or composer
      if (this.lensEffect && !this.lensEffect.fallbackActive) {
        this.lensEffect.render();
      } else if (this.composer && typeof this.composer.render === 'function') {
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
    if (this.blackHole && this.blackHole.mesh) {
      console.log("Setting up basic black hole visualization");
      
      // Check if material exists before trying to set opacity
      if (this.blackHole.eventHorizon && this.blackHole.eventHorizon.material) {
        // Make sure the black hole's event horizon is visible but still partially transparent
        this.blackHole.eventHorizon.material.opacity = 0.85;
      }
      
      // Create a simple glow effect if it doesn't exist yet
      if (!this.blackHoleGlow) {
        const glowGeometry = new THREE.SphereGeometry(this.blackHole.getRadius() * 3, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: 0x220044,
          transparent: true,
          opacity: 0.3,
          side: THREE.BackSide
        });
        
        this.blackHoleGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.blackHoleGlow.position.copy(this.blackHole.position);
        this.scene.add(this.blackHoleGlow);
        console.log("Added blackhole glow effect");
      }
      
      // Create accretion disk with better shader for lens effect integration
      const diskGeometry = new THREE.RingGeometry(
        this.blackHole.getRadius() * 2.2,
        this.blackHole.getRadius() * 4,
        32, 
        2
      );
      
      // Use a shader material for better visual integration with lens effect
      const diskMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          radius: { value: this.blackHole.getRadius() },
          color: { value: new THREE.Color(0x304060) }, // Subtle blue
          opacity: { value: 0.4 }
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
      this.accretionDisk.position.copy(this.blackHole.position);
      this.accretionDisk.rotation.x = Math.PI / 2;
      this.scene.add(this.accretionDisk);
      console.log("Added accretion disk with shader material");
      
      // Adding a simple update function for the glow and disk
      this.updateBasicRenderer = (deltaTime) => {
        const time = performance.now() * 0.001; // Current time in seconds
        
        if (this.blackHoleGlow) {
          this.blackHoleGlow.position.copy(this.blackHole.position);
          this.blackHoleGlow.scale.set(
            1.0 + this.blackHole.mass * 0.1,
            1.0 + this.blackHole.mass * 0.1,
            1.0 + this.blackHole.mass * 0.1
          );
        }
        
        if (this.accretionDisk) {
          this.accretionDisk.position.copy(this.blackHole.position);
          this.accretionDisk.rotation.z += deltaTime * 0.2;
          
          // Update time in the shader
          if (this.accretionDisk.material.uniforms) {
            this.accretionDisk.material.uniforms.time.value = time;
          }
        }
      };
      
      console.log("Basic black hole visualization complete");
    }
  }
}

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
      }
    });
    
    console.log("Start button event listener attached");
  } else {
    console.error("Start button not found in DOM!");
  }
  
  // Debug output
  console.log("Start Button HTML:", document.getElementById('start-button')?.outerHTML);
  console.log("Window.startGame is:", typeof window.startGame);
  
  // Add a global click handler for debugging
  document.addEventListener('click', (e) => {
    console.log('Click event on:', e.target);
  });
}); 