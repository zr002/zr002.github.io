/*!
 * Copyright ...
 * (License text omitted)
 */

import Light from "/lib/Viz/Light.js"
 
export default class DirectionalLight extends Light {
  constructor(intensity = [1, 1, 1], direction = [Math.sqrt(3), Math.sqrt(3), Math.sqrt(3)]) {
    super();
    for (let i = 0; i < 3; ++i) {
      this._intensity[i] = intensity[i];
      this._direction[i] = direction[i];
    }

    // NEW: Mark this as a directional light with type=1
    this._params[3] = 1.0; // 1 => directional light
  }
}
