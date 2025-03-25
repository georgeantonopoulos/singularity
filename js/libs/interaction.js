/**
 * Interaction class to handle user input and interactions with the game
 */
export class Interaction {
  /**
   * Initialize the Interaction handler
   * @param {HTMLElement} canvas - The canvas element for interaction
   * @param {Object} options - Configuration options
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = {
      preventDefault: true,
      // Camera control options
      panEnabled: true,
      zoomEnabled: true,
      panSpeed: 1.0,
      zoomSpeed: 5.0,
      minZoom: 30,
      maxZoom: 150,
      easeOutStrength: 0.12, // Higher = faster easing
      ...options
    };
    
    // Track mouse position
    this.mouse = { 
      x: 0, 
      y: 0, 
      down: false,
      middleDown: false,
      rightDown: false
    };
    this.normalizedMouse = { x: 0, y: 0 };
    
    // Camera control state
    this.camera = null;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.cameraStartX = 0;
    this.cameraStartY = 0;
    this.targetCameraX = 0;
    this.targetCameraY = 0;
    this.targetCameraZ = 0;
    this.lastWheelTime = 0;
    this.wheelDelta = 0;
    
    // Track touch positions
    this.touches = [];
    
    // Track keys
    this.keys = new Set();
    
    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    
    // Initialize event listeners
    this.addEventListeners();
    
    // Callback registry
    this.callbacks = {
      click: [],
      move: [],
      keydown: [],
      keyup: [],
      pan: [],
      zoom: []
    };
  }
  
  /**
   * Add all event listeners
   */
  addEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousemove', this.onMouseMove, true);
    this.canvas.addEventListener('mousedown', this.onMouseDown, true);
    document.addEventListener('mouseup', this.onMouseUp);
    
    // Prevent middle mouse click from being handled by other handlers
    this.canvas.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);
    
    // Prevent default behavior of middle mouse click (often auto-scroll)
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    
    // Wheel event for zooming
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    
    // Touch events
    this.canvas.addEventListener('touchstart', this.onTouchStart);
    this.canvas.addEventListener('touchmove', this.onTouchMove);
    document.addEventListener('touchend', this.onTouchEnd);
    
    // Keyboard events
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  }
  
  /**
   * Remove all event listeners
   */
  removeEventListeners() {
    // Mouse events
    this.canvas.removeEventListener('mousemove', this.onMouseMove, true);
    this.canvas.removeEventListener('mousedown', this.onMouseDown, true);
    document.removeEventListener('mouseup', this.onMouseUp);
    
    // Remove auxclick and contextmenu handlers
    this.canvas.removeEventListener('auxclick', this.onMouseDown, true);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    
    // Wheel event
    this.canvas.removeEventListener('wheel', this.onWheel);
    
    // Touch events
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    
    // Keyboard events
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }
  
  /**
   * Set the camera to control
   * @param {THREE.Camera} camera - The camera to control
   */
  setCamera(camera) {
    this.camera = camera;
    
    // Initialize target positions with current camera position
    if (camera) {
      this.targetCameraX = camera.position.x;
      this.targetCameraY = camera.position.y;
      this.targetCameraZ = camera.position.z;
    }
  }
  
  /**
   * Handle mouse movement
   * @param {MouseEvent} event - Mouse event
   */
  onMouseMove(event) {
    // Update mouse coordinates
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
    
    // Calculate normalized coordinates (-1 to 1)
    this.normalizedMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.normalizedMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Handle camera panning if middle mouse is down
    if (this.mouse.middleDown && this.options.panEnabled && this.camera) {
      // Prevent event completely when panning with middle mouse
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      const deltaX = (event.clientX - this.panStartX) * this.options.panSpeed * 0.01;
      const deltaY = (event.clientY - this.panStartY) * this.options.panSpeed * 0.01;
      
      // Set target positions for smooth easing
      this.targetCameraX = this.cameraStartX - deltaX;
      this.targetCameraY = this.cameraStartY + deltaY; // Invert Y for natural panning
      
      // Call pan callbacks
      this.callbacks.pan.forEach(callback => callback({
        deltaX: -deltaX,
        deltaY: deltaY,
        x: this.targetCameraX,
        y: this.targetCameraY
      }));
      
      // Return false to really ensure the event is completely stopped
      return false;
    }
    
    // Call registered callbacks
    this.callbacks.move.forEach(callback => callback(this.mouse));
    
    if (this.options.preventDefault) {
      event.preventDefault();
    }
  }
  
  /**
   * Handle mouse down
   * @param {MouseEvent} event - Mouse event
   */
  onMouseDown(event) {
    // Track which button is pressed
    if (event.button === 0) {
      this.mouse.down = true;
    } else if (event.button === 1) {
      // Middle mouse button - COMPLETELY prevent this event
      this.mouse.middleDown = true;
      
      // We need to capture the event in the capture phase and prevent it completely
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Start panning if enabled
      if (this.options.panEnabled && this.camera) {
        this.isPanning = true;
        this.panStartX = event.clientX;
        this.panStartY = event.clientY;
        this.cameraStartX = this.camera.position.x;
        this.cameraStartY = this.camera.position.y;
        this.canvas.style.cursor = 'grabbing'; // Visual feedback
      }
      
      return false;
    } else if (event.button === 2) {
      this.mouse.rightDown = true;
    }
    
    if (this.options.preventDefault) {
      event.preventDefault();
    }
  }
  
  /**
   * Handle mouse up
   * @param {MouseEvent} event - Mouse event
   */
  onMouseUp(event) {
    // Track which button was released
    if (event.button === 0) {
      this.mouse.down = false;
      
      // Call click callbacks if left mouse is released
      const rect = this.canvas.getBoundingClientRect();
      if (
        event.clientX >= rect.left && 
        event.clientX <= rect.right && 
        event.clientY >= rect.top && 
        event.clientY <= rect.bottom
      ) {
        this.callbacks.click.forEach(callback => callback(this.mouse));
      }
    } else if (event.button === 1) {
      // Middle mouse button
      this.mouse.middleDown = false;
      this.isPanning = false;
      this.canvas.style.cursor = 'default';
      
      // Stop event propagation
      event.stopPropagation();
    } else if (event.button === 2) {
      this.mouse.rightDown = false;
    }
  }
  
  /**
   * Handle mouse wheel for zooming
   * @param {WheelEvent} event - Wheel event
   */
  onWheel(event) {
    if (this.options.preventDefault) {
      event.preventDefault();
    }
    
    // Stop propagation to prevent other wheel handlers
    event.stopPropagation();
    
    // Only handle zooming if enabled and we have a camera
    if (!this.options.zoomEnabled || !this.camera) return;
    
    // Use deltaY for more consistent behavior across browsers
    // Note: deltaY is positive when scrolling down and negative when scrolling up
    const delta = -Math.sign(event.deltaY);
    
    // Scale zoom amount by current distance for more natural feeling
    // Further away = bigger jumps, closer = smaller, more precise jumps
    const distanceFactor = Math.max(0.5, this.camera.position.z / 90);
    const zoomAmount = delta * this.options.zoomSpeed * distanceFactor;
    
    // Update target zoom with easing
    this.targetCameraZ = Math.max(
      this.options.minZoom, 
      Math.min(this.options.maxZoom, this.camera.position.z - zoomAmount)
    );
    
    // Record time for easing calculations
    this.lastWheelTime = Date.now();
    
    // Call zoom callbacks
    this.callbacks.zoom.forEach(callback => callback({
      delta: delta,
      targetZ: this.targetCameraZ
    }));
  }
  
  /**
   * Handle touch start
   * @param {TouchEvent} event - Touch event
   */
  onTouchStart(event) {
    if (this.options.preventDefault) {
      event.preventDefault();
    }
    
    this.touches = Array.from(event.touches);
    
    // Update mouse position for single touch
    if (this.touches.length === 1) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = this.touches[0].clientX - rect.left;
      this.mouse.y = this.touches[0].clientY - rect.top;
      this.mouse.down = true;
      
      // Calculate normalized coordinates
      this.normalizedMouse.x = (this.touches[0].clientX / window.innerWidth) * 2 - 1;
      this.normalizedMouse.y = -(this.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
  }
  
  /**
   * Handle touch move
   * @param {TouchEvent} event - Touch event
   */
  onTouchMove(event) {
    if (this.options.preventDefault) {
      event.preventDefault();
    }
    
    this.touches = Array.from(event.touches);
    
    // Update mouse position for single touch
    if (this.touches.length === 1) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = this.touches[0].clientX - rect.left;
      this.mouse.y = this.touches[0].clientY - rect.top;
      
      // Calculate normalized coordinates
      this.normalizedMouse.x = (this.touches[0].clientX / window.innerWidth) * 2 - 1;
      this.normalizedMouse.y = -(this.touches[0].clientY / window.innerHeight) * 2 + 1;
      
      // Call registered move callbacks
      this.callbacks.move.forEach(callback => callback(this.mouse));
    }
  }
  
  /**
   * Handle touch end
   * @param {TouchEvent} event - Touch event
   */
  onTouchEnd(event) {
    if (this.touches.length === 1 && event.touches.length === 0) {
      this.mouse.down = false;
      
      // Call click callbacks
      this.callbacks.click.forEach(callback => callback(this.mouse));
    }
    
    this.touches = Array.from(event.touches);
  }
  
  /**
   * Handle key down
   * @param {KeyboardEvent} event - Keyboard event
   */
  onKeyDown(event) {
    this.keys.add(event.key.toLowerCase());
    
    // Call registered key callbacks
    this.callbacks.keydown.forEach(callback => callback(event.key.toLowerCase()));
  }
  
  /**
   * Handle key up
   * @param {KeyboardEvent} event - Keyboard event
   */
  onKeyUp(event) {
    this.keys.delete(event.key.toLowerCase());
    
    // Call registered key callbacks
    this.callbacks.keyup.forEach(callback => callback(event.key.toLowerCase()));
  }
  
  /**
   * Update function to handle smooth easing of camera movements
   * Call this from your game's animation loop
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    if (!this.camera) return;
    
    // Apply smooth easing to camera position
    const easeAmount = this.options.easeOutStrength;
    
    // Calculate time-based easing factor for smoother movement
    // This helps ensure consistent easing regardless of frame rate
    const scaledEaseAmount = Math.min(1.0, easeAmount * (deltaTime * 60)); // Scale by target 60 FPS
    
    // Handle pan position easing
    if (!this.mouse.middleDown) {
      // Only apply easing when not actively panning
      this.camera.position.x += (this.targetCameraX - this.camera.position.x) * scaledEaseAmount;
      this.camera.position.y += (this.targetCameraY - this.camera.position.y) * scaledEaseAmount;
    } else {
      // Direct positioning while actively panning
      this.camera.position.x = this.targetCameraX;
      this.camera.position.y = this.targetCameraY;
    }
    
    // Handle zoom easing - use stronger easing for zoom to make it feel snappier
    const zoomEaseAmount = Math.min(1.0, (easeAmount * 1.2) * (deltaTime * 60));
    this.camera.position.z += (this.targetCameraZ - this.camera.position.z) * zoomEaseAmount;
    
    // Update camera look target to match panning
    this.camera.lookAt(
      this.camera.position.x,
      this.camera.position.y,
      0
    );
  }
  
  /**
   * Check if a key is pressed
   * @param {string} key - Key to check
   * @returns {boolean} Whether key is pressed
   */
  isKeyPressed(key) {
    return this.keys.has(key.toLowerCase());
  }
  
  /**
   * Register a callback for a specific interaction
   * @param {string} type - Interaction type ('click', 'move', 'keydown', 'keyup', 'pan', 'zoom')
   * @param {Function} callback - Callback function
   */
  on(type, callback) {
    if (this.callbacks[type]) {
      this.callbacks[type].push(callback);
    }
  }
  
  /**
   * Remove a callback for a specific interaction
   * @param {string} type - Interaction type
   * @param {Function} callback - Callback function to remove
   */
  off(type, callback) {
    if (this.callbacks[type]) {
      const index = this.callbacks[type].indexOf(callback);
      if (index !== -1) {
        this.callbacks[type].splice(index, 1);
      }
    }
  }
  
  /**
   * Clean up event listeners when no longer needed
   */
  destroy() {
    this.removeEventListeners();
    this.callbacks = {
      click: [],
      move: [],
      keydown: [],
      keyup: [],
      pan: [],
      zoom: []
    };
  }
} 