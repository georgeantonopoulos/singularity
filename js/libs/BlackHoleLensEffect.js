/**
 * Custom gravitational lensing post-processing effect for Three.js
 * Simulates the bending of light around massive objects like black holes
 */

import { THREE, EffectComposer, RenderPass, ShaderPass, CopyShader } from './three-setup.js';

export class BlackHoleLensEffect {
  constructor(renderer, scene, camera, blackHole) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.blackHole = blackHole; // Store the black hole reference
    this.fallbackActive = false;
    
    // Create post-processing composer
    this.initPostProcessing();
  }
  
  initPostProcessing() {
    try {
      console.log("Initializing post processing for lens effect");
      
      // Create composer for post-processing
      this.composer = new EffectComposer(this.renderer);
      
      // First pass renders the scene
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);
      
      // Create noise texture for more detailed distortion
      const noiseTexture = this.createNoiseTexture();
      
      // Get black hole properties
      const screenPosition = this.blackHole.getScreenPosition(this.camera);
      const radius = this.blackHole.getRadius() * 2.0; // Use double the radius for visual effect
      
      // Create custom shader pass for the gravitational lensing effect
      this.lensPass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          blackHolePosition: { value: new THREE.Vector2(
            screenPosition.x / window.innerWidth,
            1.0 - (screenPosition.y / window.innerHeight) // Flip Y for WebGL
          )},
          blackHoleMass: { value: this.blackHole.mass },
          schwarzschildRadius: { value: this.blackHole.getRadius() },
          screenRatio: { value: window.innerWidth / window.innerHeight },
          noiseTexture: { value: noiseTexture },
          time: { value: 0.0 },
          intensity: { value: 1.0 }
        },
        vertexShader: `
          varying vec2 vUv;
          
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform sampler2D noiseTexture;
          uniform vec2 blackHolePosition;
          uniform float blackHoleMass;
          uniform float schwarzschildRadius;
          uniform float screenRatio;
          uniform float time;
          uniform float intensity;
          
          varying vec2 vUv;
          
          // Constants for physical simulation
          const float c = 1.0; // Speed of light (normalized)
          const float G = 1.0; // Gravitational constant (normalized)
          
          void main() {
            // Correct aspect ratio distortion
            vec2 uv = vUv;
            vec2 center = blackHolePosition;
            
            // Calculate distance from black hole center, correcting for aspect ratio
            vec2 pos = uv - center;
            pos.x *= screenRatio;
            float dist = length(pos);
            
            // Calculate the Schwarzschild radius (proportional to mass)
            float rs = 2.0 * G * blackHoleMass / (c * c);
            
            // Scale the event horizon radius for better visualization
            float visualRadius = schwarzschildRadius * 0.5;
            
            // Inside event horizon - pure black
            if (dist < visualRadius * 0.8) {
              gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
              return;
            }
            
            // Create a physically-based lensing effect
            // Light bending becomes stronger closer to the black hole
            // Based on gravitational lensing equation: θ = 4GM/bc²
            // where b is the impact parameter (distance from center)
            
            // Calculate deflection factor based on distance
            float deflectionFactor;
            if (dist < visualRadius) {
              // Transitional zone: smooth gradient to black
              deflectionFactor = 0.0;
              float fade = smoothstep(visualRadius * 0.8, visualRadius, dist);
              gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - fade);
              return;
            } else if (dist < visualRadius * 2.5) {
              // Gravitational lensing zone - limited to a smaller radius around the black hole
              // Higher power for more dramatic effect near the event horizon
              deflectionFactor = intensity * pow(visualRadius / dist, 1.8) * 1.5;
              
              // Taper off effect at the outer edge
              deflectionFactor *= smoothstep(visualRadius * 2.5, visualRadius, dist);
            } else {
              // Outside the lensing effect zone
              gl_FragColor = texture2D(tDiffuse, uv);
              return;
            }
            
            // Add subtle time-based ripples with longer wavelength
            // Use slower and longer wavelength for less noisy, more elegant ripples
            float timeRipple = sin(dist * 15.0 - time * 0.8) * 0.04;
            deflectionFactor *= (1.0 + timeRipple);
            
            // Create Einstein ring effect - intensify at certain radius
            float ringFactor = smoothstep(visualRadius, visualRadius * 1.1, dist) 
                             * smoothstep(visualRadius * 1.6, visualRadius * 1.1, dist);
            
            // Direction from pixel to black hole center
            vec2 dir = normalize(pos);
            
            // Apply distortion: redirect rays toward the black hole center
            // The closer to the black hole, the stronger the bending
            vec2 offset = dir * deflectionFactor;
            
            // Enhanced distortion near Einstein ring
            offset += dir * ringFactor * deflectionFactor * 0.5;
            
            // Sample the scene texture with the distorted coordinates
            vec2 distortedUv = uv - offset;
            
            // Get the distorted color
            vec4 color = texture2D(tDiffuse, distortedUv);
            
            // Add subtle blue shift for closer areas (gravitational blueshift effect)
            if (dist < visualRadius * 2.0) {
              float blueShift = 1.0 - smoothstep(visualRadius, visualRadius * 2.0, dist);
              color.b = mix(color.b, color.b * 1.2, blueShift * 0.3);
              color.r = mix(color.r, color.r * 0.9, blueShift * 0.2);
            }
            
            // Brighten the Einstein ring more noticeably
            color.rgb += vec3(0.15, 0.15, 0.35) * ringFactor * intensity * 0.5;
            
            gl_FragColor = color;
          }
        `
      });
      
      // Ensure lens pass runs after scene rendering
      this.lensPass.renderToScreen = true;
      this.composer.addPass(this.lensPass);
      
      // Set up window resize listener
      window.addEventListener('resize', () => this.onResize());
      
      // Set effect as active 
      this.fallbackActive = false;
      
      console.log("Gravitational lens effect initialized successfully");
    } catch (error) {
      console.error("Failed to initialize post-processing:", error);
      // Set fallback flag to true
      this.fallbackActive = true;
    }
  }
  
  // Create a noise texture for use in the shader
  createNoiseTexture() {
    try {
      // Use a simple canvas to generate noise
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.warn("Could not get canvas context for noise texture");
        // Create a simple data texture as fallback
        const data = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size * 4; i += 4) {
          const val = Math.floor(Math.random() * 255);
          data[i] = val;     // r
          data[i + 1] = val; // g
          data[i + 2] = val; // b
          data[i + 3] = 255; // a
        }
        
        const fallbackTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        fallbackTexture.needsUpdate = true;
        fallbackTexture.wrapS = THREE.RepeatWrapping;
        fallbackTexture.wrapT = THREE.RepeatWrapping;
        return fallbackTexture;
      }
      
      // Fill with noise
      const imageData = ctx.createImageData(size, size);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val;     // r
        data[i + 1] = val; // g
        data[i + 2] = val; // b
        data[i + 3] = 255; // a
      }
      ctx.putImageData(imageData, 0, 0);
      
      // Create texture
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true; // Ensure the texture is updated
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      
      return texture;
    } catch (error) {
      console.error("Error creating noise texture:", error);
      
      // Create a simple colored texture as emergency fallback
      const fallbackSize = 4; // Very small texture
      const fallbackData = new Uint8Array(fallbackSize * fallbackSize * 4);
      for (let i = 0; i < fallbackData.length; i += 4) {
        fallbackData[i] = 128;     // r
        fallbackData[i + 1] = 128; // g
        fallbackData[i + 2] = 128; // b
        fallbackData[i + 3] = 255; // a
      }
      
      const emergencyTexture = new THREE.DataTexture(
        fallbackData, fallbackSize, fallbackSize, THREE.RGBAFormat
      );
      emergencyTexture.needsUpdate = true;
      return emergencyTexture;
    }
  }
  
  onResize() {
    // Update screen ratio in the shader uniforms
    if (this.lensPass && this.lensPass.uniforms) {
      this.lensPass.uniforms.screenRatio.value = window.innerWidth / window.innerHeight;
    }
    
    // Update EffectComposer size
    if (this.composer) {
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
  }
  
  update(blackHolePosition, blackHoleMass, camera) {
    try {
      if (!this.lensPass || !this.lensPass.uniforms) {
        console.error("Lens pass or uniforms not initialized properly");
        this.fallbackActive = true;
        return;
      }

      // Calculate Schwarzschild radius from mass
      // rs = 2GM/c^2 but we're using a simplified formula for the visualization
      const schwarzschildRadius = blackHoleMass * 0.1; // Scale down for visual purposes
      
      // Ensure positions are valid numbers before updating uniforms
      if (isNaN(blackHolePosition.x) || isNaN(blackHolePosition.y)) {
        console.warn("Invalid black hole position received:", blackHolePosition);
        return;
      }
      
      // Log position for debugging - then remove these logs in final version
      // console.log("Updating lens with position:", blackHolePosition.x, blackHolePosition.y);
      
      // Update our shader uniforms with current black hole parameters
      // Convert from screen coordinates to normalized (0-1) coordinates
      this.lensPass.uniforms.blackHolePosition.value.set(
        blackHolePosition.x / window.innerWidth,
        1.0 - (blackHolePosition.y / window.innerHeight) // Flip Y coordinate for WebGL
      );
      
      // Update mass and radius in the shader - scale properly to prevent overly large effects
      this.lensPass.uniforms.blackHoleMass.value = Math.min(blackHoleMass, 50); // Cap the visual effect for very large masses
      
      if (this.lensPass.uniforms.schwarzschildRadius) {
        this.lensPass.uniforms.schwarzschildRadius.value = schwarzschildRadius;
      }
      
      // Set the effect intensity based on the black hole's size but keep it constrained
      this.lensPass.uniforms.intensity.value = Math.min(0.8 + (blackHoleMass * 0.05), 2.0);
      
      // Update time for animated effects
      if (this.lensPass.uniforms.time) {
        this.lensPass.uniforms.time.value += 0.016; // Assume ~60fps
      }
      
      // Keep the screen ratio updated in case of window resize
      if (this.lensPass.uniforms.screenRatio) {
        this.lensPass.uniforms.screenRatio.value = window.innerWidth / window.innerHeight;
      }
    } catch (error) {
      console.error("Error updating lens effect uniforms:", error);
      this.fallbackActive = true;
    }
  }
  
  render() {
    try {
      if (this.fallbackActive) {
        // Use standard renderer
        console.log("Using fallback renderer for lens effect");
        this.renderer.render(this.scene, this.camera);
        return;
      }
      
      if (!this.composer) {
        console.error("Composer not initialized!");
        this.fallbackActive = true;
        this.renderer.render(this.scene, this.camera);
        return;
      }

      // Check if render pass is properly set up
      if (!this.lensPass || !this.lensPass.uniforms) {
        console.error("Lens pass or uniforms not properly initialized!");
        this.fallbackActive = true;
        this.renderer.render(this.scene, this.camera);
        return;
      }
      
      if (this.blackHole) {
        try {
          // Get the black hole's screen position for the lens effect
          const screenPosition = this.blackHole.getScreenPosition(this.camera);
          
          // Log the position to help debug
          console.log("Black hole screen position:", screenPosition);
          
          // Call the updated lens effect with position, mass, and camera
          this.update(screenPosition, this.blackHole.mass, this.camera);
        } catch (updateError) {
          console.warn("Error updating lens effect position:", updateError);
          // Continue with composer render even if update fails
        }
      }
      
      // Use the composer for rendering with post-processing
      try {
        // Log render attempt
        console.log("Rendering with EffectComposer");
        this.composer.render();
        console.log("EffectComposer render complete");
      } catch (composerError) {
        console.error("EffectComposer render failed:", composerError);
        this.fallbackActive = true;
        this.renderer.render(this.scene, this.camera);
      }
      
    } catch (renderError) {
      console.error('Error in lens effect render:', renderError);
      this.fallbackActive = true;
      
      // Fallback to standard rendering
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (fallbackError) {
        console.error('Critical error: Even fallback rendering failed:', fallbackError);
        // Log WebGL info to help diagnose the issue
        const gl = this.renderer.getContext();
        console.error('WebGL context info:', {
          contextLost: gl.isContextLost ? gl.isContextLost() : 'unknown',
          renderer: gl.getParameter ? gl.getParameter(gl.RENDERER) : 'unknown',
          vendor: gl.getParameter ? gl.getParameter(gl.VENDOR) : 'unknown',
          extensions: gl.getSupportedExtensions ? gl.getSupportedExtensions() : 'unknown'
        });
      }
    }
  }
} 