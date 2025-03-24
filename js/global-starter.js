// This script ensures the startGame function is available globally
// It's loaded without type="module" to ensure global scope

// A backup implementation for window.startGame
window.startGame = function() {
  console.log("Global startGame function called from global-starter.js");
  
  // First check if window.game exists and has startGame method
  if (window.game && typeof window.game.startGame === 'function') {
    console.log("Game instance found, starting game...");
    window.game.startGame();
    return;
  }
  
  console.log("Game instance not found or not ready! Will retry in 500ms...");
  
  // Retry after a short delay to handle race conditions
  setTimeout(() => {
    if (window.game && typeof window.game.startGame === 'function') {
      console.log("Retrying game start...");
      window.game.startGame();
    } else {
      // Try a longer delay as a last resort
      console.log("Game instance still not available after delay. Final retry in 1 second...");
      
      setTimeout(() => {
        if (window.game && typeof window.game.startGame === 'function') {
          console.log("Final retry successful!");
          window.game.startGame();
        } else {
          console.log("Game instance still not available after final delay.");
          
          // Emergency: Create a new game instance if all else fails
          try {
            console.log("Emergency: attempting to create a new game instance...");
            // Look for Game class, first on window, then as global
            if (typeof window.Game === 'function') {
              console.log("Found Game class on window object");
              window.game = new window.Game();
              window.game.startGame();
            } else if (typeof Game === 'function') {
              console.log("Found Game class as global");
              window.game = new Game();
              window.game.startGame();
            } else {
              console.error("Game class not found! Waiting for script to load...");
              
              // Wait for main.js to load completely
              document.addEventListener('DOMContentLoaded', () => {
                console.log("DOM fully loaded, final attempt to start game");
                if (window.game) {
                  window.game.startGame();
                } else if (typeof window.Game === 'function') {
                  window.game = new window.Game();
                  window.game.startGame();
                } else {
                  console.error("Unable to start game. Please refresh the page.");
                  alert("Error starting game. Please refresh the page and try again.");
                }
              });
            }
          } catch (e) {
            console.error("Emergency game creation failed:", e);
            alert("Error starting game. Please refresh the page and try again.");
          }
        }
      }, 1000);
    }
  }, 500);
}; 