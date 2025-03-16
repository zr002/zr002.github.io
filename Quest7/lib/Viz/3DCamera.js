/*!
 * Copyright (c) 2025 SingChun LEE @ Bucknell University. CC BY-NC 4.0.
 * 
 * This code is provided mainly for educational purposes at Bucknell University.
 *
 * This code is licensed under the Creative Commons Attribution-NonCommerical 4.0
 * International License. To view a copy of the license, visit 
 *   https://creativecommons.org/licenses/by-nc/4.0/
 * or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
 *
 * You are free to:
 *  - Share: copy and redistribute the material in any medium or format.
 *  - Adapt: remix, transform, and build upon the material.
 *
 * Under the following terms:
 *  - Attribution: You must give appropriate credit, provide a link to the license,
 *                 and indicate if changes where made.
 *  - NonCommerical: You may not use the material for commerical purposes.
 *  - No additional restrictions: You may not apply legal terms or technological 
 *                                measures that legally restrict others from doing
 *                                anything the license permits.
 */
 
import PGA3D from '/lib/Math/PGA3D.js'
 
export default class Camera {
  constructor(width, height) {
    this._pose = new Float32Array(Array(16).fill(0));
    this._pose[0] = 1;
    this._focal = new Float32Array(Array(2).fill(1));
    this._resolutions = new Float32Array([width, height]);
  }
  
  resetPose() {
    this._pose[0] = 1;
    for (let i = 1; i < 16; ++i) this._pose[i] = 0;
    this._focal[0] = 1;
    this._focal[1] = 1;
  }
  
  updatePose(newpose) {
    for (let i = 0; i < 16; ++i) this._pose[i] = newpose[i];
  }
  
  updateSize(width, height) {
    this._resolutions[0] = width;
    this._resolutions[1] = height;
  }

  // --- Move along local +X axis ---
  moveX(d) {
    // For now, let’s keep it simple: just add to pose[0].
    // If you want local-axis movement that respects rotation,
    // see below for how to multiply by a rotation matrix.
    this._pose[0] += d;
  }
  
  moveY(d) {
    this._pose[1] += d;
  }
  
  moveZ(d) {
    this._pose[2] += d;
  }
  
  // --- Rotate around local X-axis ---
  rotateX(d) {
    this._pose[4] += d;
  }
  
  // --- Rotate around local Y-axis ---
  rotateY(d) {
    this._pose[5] += d;
  }
  
  // --- Rotate around local Z-axis ---
  rotateZ(d) {
    this._pose[6] += d;
  }
}
