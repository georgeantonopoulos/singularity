# 3D Camera Conversion Plan

## Overview
This branch is dedicated to converting the game from an orthographic camera (2D view) to a perspective camera (3D view) while maintaining the same game dynamics and gameplay.

## Current Implementation
- The game currently uses an orthographic camera in Three.js
- The camera is positioned at z=80 looking at the origin (0,0,0)
- The frustum size is 60 units
- The game area is defined by:
  - gameWidth = 100
  - gameHeight = 60

## Conversion Strategy
1. **Analysis Phase** (Current)
   - Understanding the current camera implementation
   - Identifying all code sections that depend on the orthographic camera
   - Analyzing game dynamics that might be affected by the perspective camera

2. **Development Phase** (Upcoming)
   - Replace OrthographicCamera with PerspectiveCamera
   - Adjust field of view, near and far planes
   - Modify camera position and controls to maintain similar view
   - Update all screen-to-world and world-to-screen coordinate conversions
   - Adapt UI elements to work with perspective projection

3. **Testing Phase** (Upcoming)
   - Test gameplay dynamics to ensure they remain unchanged
   - Verify that object interactions remain consistent
   - Fine-tune camera parameters for optimal experience

## Key Considerations
- The lens distortion effect around the black hole might need adjustments
- Mouse input handling will need updates for proper world space mapping
- Game boundaries and object spawning will need recalibration
- Camera animations and zoom effects will need to be reimplemented 