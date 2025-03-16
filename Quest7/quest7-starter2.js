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

import RayTracer from '/lib/Viz/RayTracer.js'
import StandardTextObject from '/lib/DSViz/StandardTextObject.js'
import VolumeRenderingSimpleObject from '/lib/DSViz/VolumeRenderingSimpleObject2.js'
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

  // Create an object to trace (volume rendering)
  var tracerObj = new VolumeRenderingSimpleObject(tracer._device, tracer._canvasFormat, camera);
  await tracer.setTracerObject(tracerObj);

  // --- Create Transfer Function Uniform Buffer ---
  // This buffer will hold a single unsigned integer (4 bytes)
  var tfType = 0; // initial transfer function type (0: linear)
  tracerObj.tfBuffer = tracer._device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  tracer._device.queue.writeBuffer(tracerObj.tfBuffer, 0, new Uint32Array([tfType]));

  // IMPORTANT: Make sure VolumeRenderingSimpleObject2.js includes this buffer in its bind group (binding 4).

  // -- Keyboard Controls --
  document.addEventListener('keydown', (evt) => {
    switch (evt.key) {
      // --- Camera Translate ---
      case 'w': // move camera forward
        camera.moveZ(0.1);
        tracerObj.updateCameraPose();
        break;
      case 's': // move camera backward
        camera.moveZ(-0.1);
        tracerObj.updateCameraPose();
        break;
      case 'a': // move camera left
        camera.moveX(-0.1);
        tracerObj.updateCameraPose();
        break;
      case 'd': // move camera right
        camera.moveX(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'q': // move camera up
        camera.moveY(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'e': // move camera down
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
      case 'z': // roll camera +Z
        camera.rotateZ(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'x': // roll camera -Z
        camera.rotateZ(-0.1);
        tracerObj.updateCameraPose();
        break;

      // --- Toggle projective camera ---
      case 'p':
        camera.toggleProjective();
        break;

      // --- Adjust focal lengths ---
      case 'f':
        camera._focal[0] += 0.1;
        tracerObj.updateCameraFocal();
        break;
      case 'F': // Shift+f
        camera._focal[0] -= 0.1;
        tracerObj.updateCameraFocal();
        break;
      case 'g':
        camera._focal[1] += 0.1;
        tracerObj.updateCameraFocal();
        break;
      case 'G':
        camera._focal[1] -= 0.1;
        tracerObj.updateCameraFocal();
        break;

      case '1':
        tfType = 0;
        tracer._device.queue.writeBuffer(tracerObj.tfBuffer, 0, new Uint32Array([tfType]));
        tracerObj.createBindGroup(tracer._offScreenTexture);
        console.log("tfType updated to:", tfType);
        break;
      case '2':
        tfType = 1;
        tracer._device.queue.writeBuffer(tracerObj.tfBuffer, 0, new Uint32Array([tfType]));
        tracerObj.createBindGroup(tracer._offScreenTexture);
        console.log("tfType updated to:", tfType);
        break;
      case '3':
        tfType = 2;
        tracer._device.queue.writeBuffer(tracerObj.tfBuffer, 0, new Uint32Array([tfType]));
        tracerObj.createBindGroup(tracer._offScreenTexture);
        console.log("tfType updated to:", tfType);
        break;
      case '4':
        tfType = 3;
        tracer._device.queue.writeBuffer(tracerObj.tfBuffer, 0, new Uint32Array([tfType]));
        tracerObj.createBindGroup(tracer._offScreenTexture);
        console.log("tfType updated to:", tfType);
        break;
      
    }
  });

  // Create an instructions overlay + FPS text
  let fps = '??';
  var instructions = 
`CONTROLS:
Camera Move:
  W / S : Forward / Back
  A / D : Left / Right
  Q / E : Up / Down

Camera Rotate:
  Arrow Keys : Rotate X / Y
  Z / X : Roll camera

FPS: ${fps}`;

  var fpsText = new StandardTextObject(instructions);

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
      //tracer._device.queue.writeBuffer(tracerObj.tfBuffer, 0, new Uint32Array([2]));
      //tracerObj.createBindGroup(tracer._offScreenTexture);
      tracer.render();
    }
    requestAnimationFrame(renderFrame);
  };
  lastCalled = Date.now();
  renderFrame();

  // Update instructions text with current FPS once per second
  setInterval(() => {
    fpsText.updateText(
`CONTROLS:
Camera Move:
  W / S : Forward / Back
  A / D : Left / Right
  Q / E : Up / Down

Camera Rotate:
  Arrow Keys : Rotate X / Y
  Z / X : Roll cameradd

FPS: ${frameCnt}`
    );
    frameCnt = 0;
  }, 1000);

  return tracer;
}

init().then(ret => {
  console.log(ret);
}).catch(error => {
  const pTag = document.createElement('p');
  pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
  document.body.appendChild(pTag);
  document.getElementById("renderCanvas").remove();
});
