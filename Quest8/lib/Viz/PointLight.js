/*!
 * Copyright ...
 * (License text omitted)
 */

import Light from "/Quest8/lib/Viz/Light.js"

export default class PointLight extends Light {
  constructor(intensity = [1, 1, 1], position = [0, 0, 0], attenuation = [1, 0.1, 0.01]) {
    super();
    for (let i = 0; i < 3; ++i) {
      this._intensity[i] = intensity[i];
      this._position[i] = position[i];
      this._attenuation[i] = attenuation[i];
    }

    // NEW: We set the lightType to 0 for "point". 
    // We'll store it in _params[3], so the WGSL can read it.
    // (DirectionalLight will store 1, SpotLight will store 2, etc.)
    this._params[3] = 0.0; // 0 => point light
  }
}
