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
      
      // Create a new composer - use the imported EffectComposer directly
      this.composer = new EffectComposer(this.renderer);
      console.log("EffectComposer created successfully");
      
      // Add the standard scene render pass first
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);
      console.log("RenderPass added to composer");
      
      // Create a noise texture for more interesting visuals
      const noiseTexture = this.createNoiseTexture();
      console.log("Noise texture created for lens effect");
      
      // Create our lens shader pass with full gravitational lensing implementation
      this.lensPass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          tNoise: { value: noiseTexture },
          blackHolePosition: { value: new THREE.Vector2(0.5, 0.5) },
          blackHoleMass: { value: 1.0 },
          schwarzschildRadius: { value: 0.1 },
          screenRatio: { value: window.innerWidth / window.innerHeight },
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
          uniform sampler2D tDiffuse; // The rendered scene texture
          uniform sampler2D tNoise; // Noise texture for additional effects
          uniform vec2 blackHolePosition; // Position of black hole in normalized coordinates (0-1)
          uniform float blackHoleMass; // Mass of the black hole
          uniform float schwarzschildRadius; // Schwarzschild radius
          uniform float screenRatio; // Width/height ratio to handle non-square screens
          uniform float time; // For animation effects
          uniform float intensity; // Overall effect intensity
          
          varying vec2 vUv;
          
          // Improved noise function for subtle background variations
          float noise(vec2 p) {
            return texture2D(tNoise, p * 0.01 + vec2(sin(time*0.1), cos(time*0.1))).r;
          }
          
          void main() {
            // Current pixel coordinate (normalized 0-1)
            vec2 uv = vUv;
            
            // Calculate vector from current pixel to black hole
            vec2 direction = blackHolePosition - uv;
            
            // Correct for screen aspect ratio
            direction.x *= screenRatio;
            
            // Distance from pixel to black hole
            float distance = length(direction);
            
            // Normalize the direction vector for later use
            vec2 normalizedDirection = normalize(direction);
            
            // Calculate Schwarzschild radius in screen space with better scaling
            float screenSpaceRadius = schwarzschildRadius * 0.03 * (1.0 + blackHoleMass * 0.02); 
            
            // Determine the maximum effect radius based on mass (more tightly constrained)
            // Make the effect grow much more slowly with mass
            float maxEffectRadius = screenSpaceRadius * (3.0 + blackHoleMass * 0.2);
            
            // Create a feathered mask for the effect
            // 1.0 = full effect, 0.0 = no effect
            float featherStart = maxEffectRadius * 0.7; // Start closer to the black hole
            float featherEnd = maxEffectRadius;
            float effectMask = 1.0 - smoothstep(featherStart, featherEnd, distance);
            
            // Default to unmodified scene for pixels outside effect radius
            if (effectMask <= 0.001) {
              gl_FragColor = texture2D(tDiffuse, vUv);
              return;
            }
            
            // Calculate physically-based gravitational lensing effect
            float deflectionStrength;
            
            if (distance < screenSpaceRadius * 1.5) {
              // Inside event horizon - complete black with slight glow
              float edgeFactor = smoothstep(0.0, screenSpaceRadius * 1.5, distance);
              vec3 edgeColor = mix(vec3(0.0), vec3(0.3, 0.1, 0.5), edgeFactor);
              gl_FragColor = vec4(edgeColor * 0.2, 1.0);
              return;
            } else {
              // Realistic lensing equation approximation
              // Using a modified version of Einstein's gravitational lensing equation
              deflectionStrength = screenSpaceRadius * blackHoleMass / (distance * distance);
              deflectionStrength = min(deflectionStrength, 0.1); // Reduce maximum distortion
              
              // Enhance effect near the event horizon for more dramatic visuals
              // But make it drop off more quickly with distance
              float edgeFactor = screenSpaceRadius / max(distance - screenSpaceRadius, 0.001);
              edgeFactor = pow(edgeFactor, 1.5); // Steeper falloff
              deflectionStrength *= 1.0 + 3.0 * edgeFactor * intensity;
            }
            
            // Apply the feathered mask to the deflection strength
            deflectionStrength *= effectMask;
            
            // Calculate the UV offset based on the deflection
            vec2 offset = normalizedDirection * deflectionStrength;
            
            // Add time-varying warp for a more dynamic effect (but keep it small)
            float animatedWarp = sin(time * 0.5 + distance * 20.0) * 0.0003;
            offset += normalizedDirection * animatedWarp * (1.0 + blackHoleMass * 0.05) * effectMask;
            
            // Apply chromatic aberration near the black hole (light splitting into colors)
            vec2 redOffset = offset * 0.98;
            vec2 blueOffset = offset * 1.02;
            
            // Sample the texture with distorted coordinates for each color channel
            vec2 distortedUV = uv - offset;
            vec2 distortedUV_red = uv - redOffset;
            vec2 distortedUV_blue = uv - blueOffset;
            
            // Clamp UV coordinates to prevent edge artifacts
            distortedUV = clamp(distortedUV, 0.0, 1.0);
            distortedUV_red = clamp(distortedUV_red, 0.0, 1.0);
            distortedUV_blue = clamp(distortedUV_blue, 0.0, 1.0);
            
            // Get base color with chromatic aberration
            vec4 baseColor = texture2D(tDiffuse, distortedUV);
            float red = texture2D(tDiffuse, distortedUV_red).r;
            float blue = texture2D(tDiffuse, distortedUV_blue).b;
            
            // Create the color with chromatic aberration
            vec4 color = vec4(red, baseColor.g, blue, baseColor.a);
            
            // Apply blue/red shift effects based on distance (gravitational redshift)
            float blueshift = screenSpaceRadius / max(distance - screenSpaceRadius, 0.001) * 0.1;
            color.rgb = mix(color.rgb, color.rgb * vec3(0.8, 0.9, 1.3), blueshift * effectMask);
            
            // Create Einstein ring effect - a bright ring around the black hole
            // Make the ring smaller and closer to the black hole
            float einsteinRingDistance = screenSpaceRadius * 1.8;
            float ringWidth = screenSpaceRadius * 0.2;
            float ringIntensity = smoothstep(einsteinRingDistance - ringWidth, einsteinRingDistance, distance) * 
                                 smoothstep(einsteinRingDistance + ringWidth, einsteinRingDistance, distance);
            
            // Create more vibrant, gold-colored Einstein ring
            color.rgb += vec3(1.0, 0.8, 0.4) * ringIntensity * 0.5 * intensity * effectMask;
            
            // Final color
            gl_FragColor = color;
          }
        `
      });
      
      console.log("Lens pass created with gravitational lensing shader");
      
      // This makes it the final pass in the chain
      this.lensPass.renderToScreen = true;
      this.composer.addPass(this.lensPass);
      console.log("Lens pass added to composer");
      
      // Set size of composer to match renderer
      this.composer.setSize(window.innerWidth, window.innerHeight);
      
      console.log("Gravitational lens effect initialized successfully");
    } catch (error) {
      console.error("Could not initialize post-processing:", error);
      console.error("Specific error details:", error.message);
      console.error("Stack trace:", error.stack);
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