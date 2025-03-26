// This script ensures the startGame function is available globally
// It's loaded without type="module" to ensure global scope

// Wait for main.js to load and initialize
let gameInitialized = false;

// A backup implementation for window.startGame
window.startGame = function() {
  console.log("Global startGame function called from global-starter.js");
  
  // First check if window.game exists and has startGame method
  if (window.game && typeof window.game.startGame === 'function') {
    console.log("Game instance found, starting game...");
    window.game.startGame();
    return;
  }
  
  // If game is not initialized yet, wait for main.js to load
  if (!gameInitialized) {
    console.log("Waiting for main.js to initialize...");
    
    // Check if main.js script element exists
    const mainScript = document.querySelector('script[src*="main.js"]');
    if (!mainScript) {
      console.error("main.js script not found in document!");
      return;
    }

    // Create a new promise that resolves when main.js loads
    const waitForMain = new Promise((resolve) => {
      mainScript.addEventListener('load', resolve);
    });

    // Wait for main.js to load and then try to start the game
    waitForMain.then(() => {
      console.log("main.js loaded, attempting to start game...");
      setTimeout(() => {
        if (window.game && typeof window.game.startGame === 'function') {
          console.log("Game instance found after main.js load, starting game...");
          window.game.startGame();
        } else {
          console.error("Game instance still not available after main.js load");
        }
      }, 100); // Small delay to ensure initialization
    });
    
    return;
  }
  
  console.error("Unable to start game. Please refresh the page.");
}; 