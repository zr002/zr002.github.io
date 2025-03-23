import PGA3D from '/lib/Math/PGA3D.js'

export default class Camera {
  constructor(width, height) {
    // Instead of storing the full 16-float motor directly, we store the basic parameters.
    // _translation holds [tx, ty, tz]
    this._translation = new Float32Array([0, 0, 0]);
    // _rotation holds Euler angles [rx, ry, rz] (in radians)
    this._rotation = new Float32Array([0, 0, 0]);
    
    // _pose will store the full 16-float motor (computed from the above parameters)
    this._pose = new Float32Array(16);
    
    // Focal length (2 floats)
    this._focal = new Float32Array([1, 1]);
    // Resolution (2 floats)
    this._resolutions = new Float32Array([width, height]);
    
    // Default camera mode: orthographic (false) or projective (true)
    this._isProjective = false;
    
    // Compute the full transformation motor on startup.
    this._recalcPose();
  }
  
  // NEW: Recalculate the full 16-float motor from _translation and _rotation.
  _recalcPose() {
    // Create a translation motor from the translation parameters.
    const translator = PGA3D.createTranslator(
      this._translation[0],
      this._translation[1],
      this._translation[2]
    );
    
    // Create rotors for each Euler angle.
    // (Assuming a simple rotation around the world axes; order here is X then Y then Z.)
    const rotorX = PGA3D.createRotor(this._rotation[0], 1, 0, 0, 0, 0, 0);
    const rotorY = PGA3D.createRotor(this._rotation[1], 0, 1, 0, 0, 0, 0);
    const rotorZ = PGA3D.createRotor(this._rotation[2], 0, 0, 1, 0, 0, 0);
    
    // Combine the rotors in order (order matters).
    let combinedRotor = PGA3D.geometricProduct(rotorX, rotorY);
    combinedRotor = PGA3D.geometricProduct(combinedRotor, rotorZ);
    
    // Combine the translation and rotation to form the full motor.
    const fullMotor = PGA3D.geometricProduct(translator, combinedRotor);
    
    // Convert the full motor (which is a plain array) into a Float32Array.
    const motorArray = Float32Array.from(fullMotor);
    
    // Update _pose with the 16 floats.
    for (let i = 0; i < 16; i++) {
      this._pose[i] = motorArray[i];
    }
  }
  
  // NEW: Move functions update the translation and then recalc the motor.
  moveX(d) {
    this._translation[0] += d;
    this._recalcPose();
  }
  moveY(d) {
    this._translation[1] -= d;
    this._recalcPose();
  }
  moveZ(d) {
    this._translation[2] -= d;
    this._recalcPose();
  }
  
  // NEW: Rotate functions update the rotation parameters and then recalc the motor.
  rotateX(d) {
    this._rotation[0] += d;
    this._recalcPose();
  }
  rotateY(d) {
    this._rotation[1] += d;
    this._recalcPose();
  }
  rotateZ(d) {
    this._rotation[2] += d;
    this._recalcPose();
  }
  
  // Toggle between orthographic and projective modes.
  toggleProjective() {
    this._isProjective = !this._isProjective;
  }
  
  // Also update resolution if needed.
  updateSize(width, height) {
    this._resolutions[0] = width;
    this._resolutions[1] = height;
  }
}
