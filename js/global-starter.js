// This script ensures the startGame function is available globally
// It's loaded without type="module" to ensure global scope

// A backup implementation for window.startGame
window.startGame = function() {
  console.log("Global startGame function called from global-starter.js");
  
  // Try to find and start the game instance
  if (window.game && typeof window.game.startGame === 'function') {
    window.game.startGame();
  } else {
    console.error("Game instance not found or not ready! Will retry in 500ms...");
    
    // Retry after a short delay to handle race conditions
    setTimeout(() => {
      if (window.game && typeof window.game.startGame === 'function') {
        console.log("Retrying game start...");
        window.game.startGame();
      } else {
        console.error("Game instance still not available after delay.");
        alert("Error starting game. Please refresh the page and try again.");
      }
    }, 500);
  }
}; 