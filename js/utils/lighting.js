import { THREE } from '../libs/three-setup.js';

export function setupLighting(scene) {
  // Ambient light - provides basic overall illumination
  const ambientLight = new THREE.AmbientLight(0x222222);
  scene.add(ambientLight);
  
  // Directional light - mimics distant light source (like a sun)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 50, 50);
  scene.add(directionalLight);
  
  // Point light from the center - provides illumination for nearby objects
  const centerLight = new THREE.PointLight(0x8844aa, 0.5, 100);
  centerLight.position.set(0, 0, 0);
  scene.add(centerLight);
  
  // Add some distant point lights for additional visual interest
  const colors = [0x3366ff, 0xff5533, 0x22ff88, 0xffcc00];
  
  // Create 4 distant lights
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI * 2 * (i / 4);
    const distance = 100;
    
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const y = (Math.random() - 0.5) * distance * 0.5;
    
    const distantLight = new THREE.PointLight(colors[i], 0.3, 150);
    distantLight.position.set(x, y, z);
    scene.add(distantLight);
  }
  
  return {
    ambientLight,
    directionalLight,
    centerLight
  };
} 