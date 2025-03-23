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
          console.error("Game instance still not available after final delay.");
          alert("Error starting game. Please refresh the page and try again.");
          
          // Emergency: Create a new game instance if all else fails
          try {
            console.log("Emergency: attempting to create a new game instance...");
            // This requires the Game class to be globally available
            if (typeof Game === 'function') {
              window.game = new Game();
              window.game.startGame();
            }
          } catch (e) {
            console.error("Emergency game creation failed:", e);
          }
        }
      }, 1000);
    }
  }, 500);
}; 