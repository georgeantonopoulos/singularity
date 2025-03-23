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
      ...options
    };
    
    // Track mouse position
    this.mouse = { x: 0, y: 0, down: false };
    this.normalizedMouse = { x: 0, y: 0 };
    
    // Track touch positions
    this.touches = [];
    
    // Track keys
    this.keys = new Set();
    
    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
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
      keyup: []
    };
  }
  
  /**
   * Add all event listeners
   */
  addEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    
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
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    
    // Touch events
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    
    // Keyboard events
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }
  
  /**
   * Handle mouse movement
   * @param {MouseEvent} event - Mouse event
   */
  onMouseMove(event) {
    if (this.options.preventDefault) {
      event.preventDefault();
    }
    
    // Update mouse coordinates
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
    
    // Calculate normalized coordinates (-1 to 1)
    this.normalizedMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.normalizedMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Call registered callbacks
    this.callbacks.move.forEach(callback => callback(this.mouse));
  }
  
  /**
   * Handle mouse down
   * @param {MouseEvent} event - Mouse event
   */
  onMouseDown(event) {
    if (this.options.preventDefault) {
      event.preventDefault();
    }
    
    this.mouse.down = true;
  }
  
  /**
   * Handle mouse up
   * @param {MouseEvent} event - Mouse event
   */
  onMouseUp(event) {
    this.mouse.down = false;
    
    // Call click callbacks if mouse is up
    const rect = this.canvas.getBoundingClientRect();
    if (
      event.clientX >= rect.left && 
      event.clientX <= rect.right && 
      event.clientY >= rect.top && 
      event.clientY <= rect.bottom
    ) {
      this.callbacks.click.forEach(callback => callback(this.mouse));
    }
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
   * Check if a key is pressed
   * @param {string} key - Key to check
   * @returns {boolean} Whether key is pressed
   */
  isKeyPressed(key) {
    return this.keys.has(key.toLowerCase());
  }
  
  /**
   * Register a callback for a specific interaction
   * @param {string} type - Interaction type ('click', 'move', 'keydown', 'keyup')
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
      keyup: []
    };
  }
} 