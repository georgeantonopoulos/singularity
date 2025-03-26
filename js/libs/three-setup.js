// Import Three.js modules locally
const LOCAL_PATH = './three/';

// Import core Three.js
import * as THREE from './three/three.module.js';

// Import controllers
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';

// Import post-processing
import { EffectComposer } from './three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from './three/examples/jsm/shaders/CopyShader.js';
import { UnrealBloomPass } from './three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Re-export all modules
export { 
  THREE, 
  OrbitControls, 
  EffectComposer, 
  RenderPass, 
  ShaderPass, 
  CopyShader,
  UnrealBloomPass
}; 