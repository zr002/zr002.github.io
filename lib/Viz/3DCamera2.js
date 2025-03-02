import Math3D from '/lib/Math/Math3D.js'

export default class Camera {
  constructor(width, height) {
    // [0..2] = position, [3] = padding
    // [4..6] = Euler angles (x,y,z), [7] = padding
    this._pose = new Float32Array(Array(8).fill(0));
    this._focal = new Float32Array(Array(2).fill(1));
    this._resolutions = new Float32Array([width, height]);
    this._isProjective = false;
  }
  
  resetPose() {
    for (let i = 0; i < 8; ++i) this._pose[i] = 0;
    this._focal[0] = 1;
    this._focal[1] = 1;
  }
  
  updatePose(newpose) {
    for (let i = 0; i < 8; ++i) {
      this._pose[i] = newpose[i];
    }
  }
  
  toggleProjective() {
    this._isProjective = !this._isProjective;
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
