import { THREE } from '../libs/three-setup.js';

export function createStarfield(scene) {
  // Create a large sphere geometry
  const geometry = new THREE.BufferGeometry();
  const count = 5000; // Number of stars
  
  // Create positions for stars
  const positions = new Float32Array(count * 3); // 3 values (x, y, z) per vertex
  const colors = new Float32Array(count * 3); // 3 values (r, g, b) per vertex
  const sizes = new Float32Array(count);
  
  // Generate random positions, colors and sizes
  for (let i = 0; i < count; i++) {
    // Position (spherical distribution)
    const radius = 800 + Math.random() * 200; // Between 800 and 1000
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    
    // Color (mostly white with some variation)
    const starType = Math.random();
    let r, g, b;
    
    if (starType < 0.1) {
      // Blue stars
      r = 0.7 + Math.random() * 0.3;
      g = 0.7 + Math.random() * 0.3;
      b = 1.0;
    } else if (starType < 0.2) {
      // Yellow stars
      r = 1.0;
      g = 0.9 + Math.random() * 0.1;
      b = 0.5 + Math.random() * 0.3;
    } else if (starType < 0.3) {
      // Red stars
      r = 1.0;
      g = 0.5 + Math.random() * 0.3;
      b = 0.5 + Math.random() * 0.3;
    } else {
      // White stars
      const intensity = 0.7 + Math.random() * 0.3;
      r = intensity;
      g = intensity;
      b = intensity;
    }
    
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    
    // Size
    sizes[i] = Math.random() * 2.0 + 0.5;
  }
  
  // Set attributes
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  // Create material
  const material = new THREE.PointsMaterial({
    size: 1,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  
  // Create points
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  
  // Create some nebulae
  createNebulae(scene);
  
  return points;
}

function createNebulae(scene) {
  // Create several nebulae at different positions
  const nebulaCount = 3;
  
  for (let i = 0; i < nebulaCount; i++) {
    // Create a nebula at a random far away position
    const radius = 600 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    const position = new THREE.Vector3(x, y, z);
    
    // Get random color for the nebula
    const colors = [
      new THREE.Color(0x3030ff), // Blue
      new THREE.Color(0xff3030), // Red
      new THREE.Color(0x30ff30), // Green
      new THREE.Color(0xff30ff)  // Purple
    ];
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Create the nebula
    createNebula(scene, position, color);
  }
}

function createNebula(scene, position, color) {
  // Create a particle system for the nebula
  const nebulaGeometry = new THREE.BufferGeometry();
  const particleCount = 500;
  
  // Create positions for particles
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  
  // Cloud size
  const cloudSize = 80 + Math.random() * 50;
  
  // Generate random positions and colors for nebula particles
  for (let i = 0; i < particleCount; i++) {
    // Use a gaussian-like distribution for particles
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    // Use a gaussian distribution for radius 
    let radius = 0;
    for (let j = 0; j < 6; j++) {
      radius += Math.random();
    }
    radius = (radius / 6) * cloudSize;
    
    // Calculate position
    const x = position.x + radius * Math.sin(phi) * Math.cos(theta);
    const y = position.y + radius * Math.sin(phi) * Math.sin(theta);
    const z = position.z + radius * Math.cos(phi);
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    
    // Color (based on the nebula color but with some variation)
    // Distance from center affects opacity
    const distFactor = 1.0 - (radius / cloudSize);
    const opacity = Math.max(0.1, Math.pow(distFactor, 2) * 0.6);
    
    // Add some variation to the color
    const variation = 0.2;
    const r = Math.max(0, Math.min(1, color.r + (Math.random() - 0.5) * variation));
    const g = Math.max(0, Math.min(1, color.g + (Math.random() - 0.5) * variation));
    const b = Math.max(0, Math.min(1, color.b + (Math.random() - 0.5) * variation));
    
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    
    // Size varies with distance from center
    sizes[i] = 5 + Math.random() * 10 * distFactor;
  }
  
  // Set attributes
  nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  nebulaGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  nebulaGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  // Create material
  const nebulaMaterial = new THREE.PointsMaterial({
    size: 4,
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  
  // Create points
  const nebulaPoints = new THREE.Points(nebulaGeometry, nebulaMaterial);
  scene.add(nebulaPoints);
  
  return nebulaPoints;
} 