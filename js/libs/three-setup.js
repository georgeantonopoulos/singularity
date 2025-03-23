// Import Three.js modules from CDN with explicit version
const CDN_PATH = 'https://unpkg.com/three@0.159.0/';

// Import core Three.js
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';

// Import controllers
import { OrbitControls } from 'https://unpkg.com/three@0.159.0/examples/jsm/controls/OrbitControls.js';

// Import post-processing
import { EffectComposer } from 'https://unpkg.com/three@0.159.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.159.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.159.0/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'https://unpkg.com/three@0.159.0/examples/jsm/shaders/CopyShader.js';

// Re-export all modules
export { 
  THREE, 
  OrbitControls, 
  EffectComposer, 
  RenderPass, 
  ShaderPass, 
  CopyShader 
}; 