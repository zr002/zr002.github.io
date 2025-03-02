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

// Check your browser supports: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status#implementation-status
// Need to enable experimental flags chrome://flags/
// Chrome & Edge 113+ : Enable Vulkan, Default ANGLE Vulkan, Vulkan from ANGLE, Unsafe WebGPU Support, and WebGPU Developer Features (if exsits)
// Firefox Nightly: sudo snap install firefox --channel=latext/edge or download from https://www.mozilla.org/en-US/firefox/channel/desktop/

import RayTracer from '/lib/Viz/RayTracer.js'
import StandardTextObject from '/lib/DSViz/StandardTextObject.js'
import RayTracingBoxObject from '/lib/DSViz/RayTracingBoxObject2.js'
import Camera from '/lib/Viz/3DCamera2.js'

async function init() {
  // Create a canvas tag
  const canvasTag = document.createElement('canvas');
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);
  // Create a ray tracer
  const tracer = new RayTracer(canvasTag);
  await tracer.init();
  // Create a 3D Camera
  var camera = new Camera();
  
  // Create an object to trace
  var tracerObj = new RayTracingBoxObject(tracer._device, tracer._canvasFormat, camera);
  await tracer.setTracerObject(tracerObj);

  document.addEventListener('keydown', (evt) => {
    switch (evt.key) {

      // --- Camera Translate ---
      case 'w':
        camera.moveZ(0.1);            // move camera forward
        tracerObj.updateCameraPose();  // upload new pose
        break;
      case 's':
        camera.moveZ(-0.1);             // backward
        tracerObj.updateCameraPose();
        break;
      case 'a':
        camera.moveX(-0.1);
        tracerObj.updateCameraPose();
        break;
      case 'd':
        camera.moveX(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'q':
        camera.moveY(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'e':
        camera.moveY(-0.1);
        tracerObj.updateCameraPose();
        break;

      // --- Camera Rotate ---
      case 'ArrowUp':
        camera.rotateX(-0.1);
        tracerObj.updateCameraPose();
        break;
      case 'ArrowDown':
        camera.rotateX(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'ArrowLeft':
        camera.rotateY(-0.1);
        tracerObj.updateCameraPose();
        break;
      case 'ArrowRight':
        camera.rotateY(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'z':
        camera.rotateZ(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'x':
        camera.rotateZ(-0.1);
        tracerObj.updateCameraPose();
        break;
      
      // --- Toggle projective camera ---
      case 'p':
        camera.toggleProjective(); // flips _isProjective
        break;
      
      case 'f':
        camera._focal[0] += 0.1;
        tracerObj.updateCameraFocal();
        break;
      // Decrease focal X only
      case 'F': // capital F, i.e. Shift+f
        camera._focal[0] -= 0.1;
        tracerObj.updateCameraFocal();
        break;
  
      // Increase focal Y only
      case 'g':
        camera._focal[1] += 0.1;
        tracerObj.updateCameraFocal();
        break;
      // Decrease focal Y only
      case 'G': // Shift+g
        camera._focal[1] -= 0.1;
        tracerObj.updateCameraFocal();
        break;

      // --- Move the box in +X / -X for example ---
      case 'j':
        // move box left
        tracerObj._box._pose[0] -= 0.1;
        tracerObj.updateBoxPose();
        break;
      case 'l':
        // move box right
        tracerObj._box._pose[0] += 0.1;
        tracerObj.updateBoxPose();
        break;
      // (Add more keys for rotating the box, etc.)
      case 'u':
        tracerObj._box._pose[4] += 0.1; // rotate box around X
        tracerObj.updateBoxPose();
        break;
      case 'i':
        tracerObj._box._pose[5] += 0.1; // rotate box around Y
        tracerObj.updateBoxPose();
        break;
      case 'o':
        tracerObj._box._pose[6] += 0.1; // rotate box around Z
        tracerObj.updateBoxPose();
        break;

    }
  });

  
  let fps = '??';
  var fpsText = new StandardTextObject(`CONTROLS:
Camera:
  W / S : Move forward / backward
  A / D : Move left / right
  Q / E : Move up / down
  Arrow Keys : Rotate X / Y
  Z / X : Roll camera
  P : Toggle pinhole / orthographic
  F/f, G/g : Adjust focal X / Y

Box:
  J / L : Move left / right
  U / I / O : Rotate X / Y / Z

FPS: ` + fps);
  
  // run animation at 60 fps
  var frameCnt = 0;
  var tgtFPS = 60;
  var secPerFrame = 1. / tgtFPS;
  var frameInterval = secPerFrame * 1000;
  var lastCalled;
  let renderFrame = () => {
    let elapsed = Date.now() - lastCalled;
    if (elapsed > frameInterval) {
      ++frameCnt;
      lastCalled = Date.now() - (elapsed % frameInterval);
      tracer.render();
    }
    requestAnimationFrame(renderFrame);
  };
  lastCalled = Date.now();
  renderFrame();
  setInterval(() => { 
    fpsText.updateText(`CONTROLS:
Camera:
  W / S : Move forward / backward
  A / D : Move left / right
  Q / E : Move up / down
  Arrow Keys : Rotate X / Y
  Z / X : Roll camera
  P : Toggle pinhole / orthographic
  F/f, G/g : Adjust focal X / Y

Box:
  J / L : Move left / right
  U / I / O : Rotate X / Y / Z

FPS: ` + frameCnt);
    frameCnt = 0;
  }, 1000); // call every 1000 ms
  return tracer;
}

init().then( ret => {
  console.log(ret);
}).catch( error => {
  const pTag = document.createElement('p');
  pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
  document.body.appendChild(pTag);
  document.getElementById("renderCanvas").remove();
});
