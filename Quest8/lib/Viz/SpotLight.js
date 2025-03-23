/*!
 * Copyright ...
 * (License text omitted)
 */

import Light from "/Quest8/lib/Viz/Light.js"
 
export default class SpotLight extends Light {
  constructor(
    intensity   = [1, 1, 1],
    position    = [0, 0, 0],
    direction   = [0, 1, 0],
    attenuation = [1, 0.1, 0.01],
    cutoff      = 0.785, 
    dropoff     = 5
  ) {
    super();
    for (let i = 0; i < 3; ++i) {
      this._intensity[i]  = intensity[i];
      this._position[i]   = position[i];
      this._direction[i]  = direction[i];
      this._attenuation[i] = attenuation[i];
    }
    // spot light has two parameters - cut off and drop off
    this._params[0] = cutoff;
    this._params[1] = dropoff;

    // NEW: Mark this as a spotlight with type=2
    this._params[3] = 2.0; // 2 => spotlight
  }
}
