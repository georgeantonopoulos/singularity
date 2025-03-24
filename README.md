# Christopher's Singularity - A Cosmic Feast Game

A physics-based game where you control a black hole and consume celestial objects to grow.
Created by my son Christopher (6) who is really interested in black holes! 

## Features

- Realistic gravitational lensing effect using Three.js post-processing
- Physics-based interactions with gravitational pull
- Beautiful cosmic visuals with stars, nebulae, and distortion effects
- Grow your black hole by consuming celestial objects

## Development Branches

- **main**: Current stable version with orthographic camera (2D view)
- **3D_cam**: Development branch for converting to a 3D perspective camera while maintaining gameplay

For details on the 3D camera conversion approach, see the [3D_CAMERA_NOTES.md](3D_CAMERA_NOTES.md) file.

## Installation

### Local Development

1. Clone this repository:
```bash
git clone https://your-repository-url.git
cd christophers_game
```

2. Install dependencies:
```bash
npm install
```

3. Start a local server:
```bash
npm start
```

4. Open your browser and navigate to http://localhost:3000

### Without npm (Simple Method)

You can also run this directly with any local server. For example, using Python:

```bash
# Python 3
python -m http.server

# Python 2
python -m SimpleHTTPServer
```

Then open your browser to http://localhost:8000

## Technical Notes

This project uses modern ES6 modules to import Three.js and its components. This approach is recommended by the Three.js team and will be the only supported method in future versions.

The main effects in the game rely on:

1. Three.js rendering for the game objects
2. Custom shader materials for the black hole visuals
3. Post-processing effects for gravitational lensing

## Browser Support

The game requires a modern browser that supports ES6 modules, WebGL, and advanced JavaScript features. For best performance, use the latest versions of Chrome, Firefox, Safari, or Edge.

## Credits

- Built with [Three.js](https://threejs.org/)
- Inspired by astrophysics and gravitational phenomena 
