// Black hole vertex shader - for 2D
export const vertexShader = `
  uniform float time;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Black hole fragment shader - for 2D
export const fragmentShader = `
  uniform float time;
  uniform float mass;
  uniform float gravitationalLensingEffect;
  
  varying vec2 vUv;
  
  void main() {
    // Calculate distance from center (0-1)
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center) * 2.0;
    
    // Black hole is totally black in the center
    vec3 color = vec3(0.0);
    
    // Create an event horizon glow effect
    float glow = smoothstep(1.0, 0.6, dist);
    glow = pow(glow, 2.0) * 0.25;
    
    // Pulsating effect based on time
    float pulse = (sin(time * 0.5) * 0.1 + 0.9) * glow;
    
    // Event horizon blueish glow
    vec3 glowColor = mix(
      vec3(0.1, 0.2, 0.8),  // Outer glow (blue)
      vec3(0.6, 0.4, 1.0),  // Inner glow (purple)
      glow
    );
    
    // Apply glow and pulsation
    color = mix(color, glowColor, pulse);
    
    // Alpha is 1.0 for the black hole, fade out at edges
    float alpha = smoothstep(1.0, 0.9, dist);
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// Accretion disk vertex shader - for 2D
export const accretionDiskVertexShader = `
  uniform float time;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Accretion disk fragment shader - for 2D
export const accretionDiskFragmentShader = `
  uniform float time;
  uniform float mass;
  
  varying vec2 vUv;
  
  void main() {
    // In polar coordinates for a ring, we need the distance from center
    // and the angle around the center
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center) * 2.0;
    
    // Calculate the angle
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    
    // Create swirling pattern based on angle
    float swirl = sin(angle * 8.0 + time * 2.0 + dist * 10.0);
    
    // Add animated plasma-like effect
    float plasma = sin(dist * 20.0 - time * 3.0) * sin(angle * 6.0 + time) * 0.25;
    
    // Create ring effect
    float ring = smoothstep(0.0, 0.4, dist) * smoothstep(1.0, 0.6, dist);
    
    // Combine effects
    float pattern = (ring + plasma * ring) * (swirl * 0.5 + 0.5);
    
    // Color gradient based on temperature (inner is hotter)
    vec3 hotColor = vec3(1.0, 0.8, 0.3); // Yellow/white hot inner disk
    vec3 warmColor = vec3(1.0, 0.4, 0.1); // Orange/red mid disk
    vec3 coolColor = vec3(0.6, 0.2, 0.0); // Red/dark outer disk
    
    // Mix colors based on distance from center
    vec3 color = mix(hotColor, warmColor, smoothstep(0.5, 0.7, dist));
    color = mix(color, coolColor, smoothstep(0.7, 0.9, dist));
    
    // Apply pattern brightness
    color *= (pattern * 1.5);
    
    // Add slight pulsing effect based on black hole mass
    float pulseFactor = sin(time * 1.0) * 0.1 * mass + 0.9;
    color *= pulseFactor;
    
    // Calculate alpha (transparent in the very center and outer edges)
    float alpha = pattern * smoothstep(0.0, 0.2, dist) * smoothstep(1.0, 0.8, dist);
    alpha *= 0.8; // Make it somewhat transparent overall
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// Improved gravitational lensing distortion field shader
export const distortionFieldFragmentShader = `
  uniform float time;
  uniform float mass;
  uniform float radius;
  uniform float distortionStrength;
  
  varying vec2 vUv;
  
  // Schwarzschild radius approximation for visual effect
  float getSchwarzschildRadius(float mass) {
    return mass * 0.1; // Simplified for visual effect
  }
  
  void main() {
    // Distance from center, normalized
    vec2 center = vec2(0.5, 0.5);
    vec2 dir = vUv - center;
    float dist = length(dir) * 2.0;
    
    // Calculate gravitational lensing effect
    // Based on real physics formula: angle = 4GM/c²b (simplified)
    // Where b is the impact parameter (distance from the light ray to the black hole)
    float schwarzschildRadius = getSchwarzschildRadius(mass);
    float lensingFactor = schwarzschildRadius / max(0.05, dist);
    
    // More physically accurate light bending visualization
    // Light is bent more at 1.5 to 3 times the Schwarzschild radius
    float photonSphereRegion = smoothstep(schwarzschildRadius, schwarzschildRadius * 3.0, dist);
    photonSphereRegion *= smoothstep(schwarzschildRadius * 4.0, schwarzschildRadius * 1.5, dist);
    
    // Visual distortion intensity - stronger close to event horizon
    float distortionIntensity = lensingFactor * distortionStrength * photonSphereRegion;
    
    // Create blue-shifted light visualization for approaching light
    float blueshiftFactor = smoothstep(1.0, 0.0, dist) * 0.3;
    vec3 baseColor = mix(vec3(0.2, 0.4, 0.9), vec3(0.1, 0.2, 1.0), blueshiftFactor);
    
    // Create red-shifted light visualization for receding light
    float redshiftFactor = smoothstep(0.0, 1.0, dist) * 0.3;
    baseColor = mix(baseColor, vec3(0.9, 0.1, 0.2), redshiftFactor * 0.2);
    
    // Create Einstein ring effect
    float einsteinRing = smoothstep(schwarzschildRadius * 1.4, schwarzschildRadius * 1.5, dist);
    einsteinRing *= smoothstep(schwarzschildRadius * 1.7, schwarzschildRadius * 1.6, dist);
    einsteinRing *= 2.0; // Enhance the effect
    
    // Add subtle pulsation and time variance
    float timePulse = sin(time * 0.5) * 0.05 + 0.95;
    float timeVarying = (sin(dist * 20.0 - time * 2.0) * 0.5 + 0.5) * 0.2;
    
    // Combine all effects 
    vec3 color = baseColor * (distortionIntensity + einsteinRing + timeVarying) * timePulse;
    
    // Alpha is stronger near the event horizon and fades out at larger distances
    // Also stronger around the Einstein ring
    float alpha = (distortionIntensity + einsteinRing * 0.5) * 0.5;
    alpha *= smoothstep(1.0, 0.1, dist); // Fade out with distance
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// Post-processing shaders for full-screen gravitational lensing
export const lensPostProcessingVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// This shader creates the actual distortion effect by warping the rendered scene
export const lensPostProcessingFragmentShader = `
  uniform sampler2D tDiffuse; // The rendered scene texture
  uniform vec2 blackHolePosition; // Position of black hole in normalized coordinates (0-1)
  uniform float blackHoleMass; // Mass of the black hole
  uniform float schwarzschildRadius; // Schwarzschild radius
  uniform float screenRatio; // Width/height ratio to handle non-square screens
  uniform float time; // For subtle animation effects
  
  varying vec2 vUv;
  
  void main() {
    // Current pixel coordinate (normalized 0-1)
    vec2 uv = vUv;
    
    // Calculate vector from current pixel to black hole
    vec2 direction = blackHolePosition - uv;
    
    // Correct for screen aspect ratio
    direction.x *= screenRatio;
    
    // Distance from pixel to black hole
    float distance = length(direction);
    
    // Normalize the direction vector
    direction = normalize(direction);
    
    // Schwarzschild radius in screen space
    float screenSpaceRadius = schwarzschildRadius * 0.03; // Scale factor 
    
    // Calculate gravitational lensing effect
    float deflectionStrength;
    
    if (distance < screenSpaceRadius * 1.5) {
      // Inside event horizon - black
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    } else {
      // Realistic lensing equation approximation
      deflectionStrength = screenSpaceRadius * blackHoleMass / (distance * distance);
      deflectionStrength = min(deflectionStrength, 0.1);
      
      // Enhance effect near the event horizon
      deflectionStrength *= 1.0 + 5.0 * pow(screenSpaceRadius / max(distance - screenSpaceRadius, 0.001), 2.0);
    }
    
    // Calculate the UV offset based on the deflection
    vec2 offset = direction * deflectionStrength;
    
    // Create subtle animated warping
    float animatedWarp = sin(time * 0.5 + distance * 20.0) * 0.0005;
    offset += direction * animatedWarp;
    
    // Sample the texture with distorted coordinates
    vec2 distortedUV = uv - offset;
    distortedUV = clamp(distortedUV, 0.0, 1.0);
    
    vec4 color = texture2D(tDiffuse, distortedUV);
    
    // Apply blue/red shift effects based on distance
    float blueshift = screenSpaceRadius / max(distance - screenSpaceRadius, 0.001) * 0.1;
    color.rgb = mix(color.rgb, color.rgb * vec3(0.8, 0.9, 1.2), blueshift);
    
    // Create Einstein ring effect
    float einsteinRingDistance = screenSpaceRadius * 2.0; 
    float ringWidth = screenSpaceRadius * 0.3;
    float ringIntensity = smoothstep(einsteinRingDistance - ringWidth, einsteinRingDistance, distance) * 
                          smoothstep(einsteinRingDistance + ringWidth, einsteinRingDistance, distance);
    
    color.rgb += vec3(1.0, 0.9, 0.7) * ringIntensity * 0.3;
    
    gl_FragColor = color;
  }
`;

// These shaders provide:
// 1. A completely black center for the black hole
// 2. A glowing accretion disk effect
// 3. A subtle gravitational lensing distortion
// 4. Animated effects that respond to the black hole's mass 
// 5. A post-processing shader for true background warping 