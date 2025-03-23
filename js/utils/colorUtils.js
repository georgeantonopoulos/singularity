/**
 * Utility functions for color manipulation and temperature conversion
 */

/**
 * Convert a temperature in Kelvin to an RGB color
 * Based on Neil Bartlett's approximation
 * @param {number} kelvin - Temperature in Kelvin (1000-40000)
 * @return {THREE.Color} RGB color representation
 */
export function colorTemperatureToRGB(kelvin) {
  // Clamp temperature to valid range
  kelvin = Math.max(1000, Math.min(40000, kelvin));
  
  let temp = kelvin / 100;
  
  let r, g, b;
  
  // Calculate red
  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    r = Math.max(0, Math.min(255, r));
  }
  
  // Calculate green
  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
  }
  g = Math.max(0, Math.min(255, g));
  
  // Calculate blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = temp - 10;
    b = 138.5177312231 * Math.log(b) - 305.0447927307;
    b = Math.max(0, Math.min(255, b));
  }
  
  // Convert to normalized values
  return {
    r: r / 255,
    g: g / 255,
    b: b / 255
  };
} 