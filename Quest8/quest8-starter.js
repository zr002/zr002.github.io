/*!
 * Copyright ...
 * (License text omitted)
 */

import RayTracer from '/Quest8/lib/Viz/RayTracer.js'
import StandardTextObject from '/Quest8/lib/DSViz/StandardTextObject.js'
import RayTracingBoxLightObject from '/Quest8/lib/DSViz/RayTracingBoxLightObject.js'
import Camera from '/Quest8/lib/Viz/3DCamera.js'
import PointLight from '/Quest8/lib/Viz/PointLight.js'
import DirectionalLight from '/Quest8/lib/Viz/DirectionalLight.js'
import SpotLight from '/Quest8/lib/Viz/SpotLight.js'

async function init() {
  // 1) Create a <canvas> for rendering
  const canvasTag = document.createElement('canvas');
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  // 2) Create the RayTracer (WebGPU wrapper)
  const tracer = new RayTracer(canvasTag);
  await tracer.init();

  // 3) Create a 3D Camera
  const camera = new Camera();
  camera._pose[2] = 1.0; // so we can see the box
  // Make sure your Camera class has an _isProjective boolean, 
  // and maybe a toggleProjective() method (or define it below).

  // 4) Create the box object
  const tracerObj = new RayTracingBoxLightObject(
    tracer._device,
    tracer._canvasFormat,
    camera
  );
  await tracer.setTracerObject(tracerObj);

  // 5) Create a PointLight and send it to the box object
  const light = new PointLight();  // default intensity/pos/attenuation
  tracerObj.updateLight(light);

  // NEW: Keep track of which light & shading & camera mode for the HUD
  let currentLight   = "Point";       // 0=point, 1=dir, 2=spot
  let currentShading = "Lambertian";  // 0=Lambert, 1=Phong, 2=Toon
  // NEW: also track camera mode (orthographic vs projective)
  let currentCameraMode = "Orthographic"; // or "Projective"

  // 6) Camera movement via keyboard (existing code)
  document.addEventListener('keydown', (evt) => {
    switch (evt.key) {

      // --- Camera Translate ---
      case 'w':
        camera.moveZ(-0.1);
        tracerObj.updateCameraPose();
        break;
      case 's':
        camera.moveZ(0.1);
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
        camera.rotateX(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'ArrowDown':
        camera.rotateX(-0.1);
        tracerObj.updateCameraPose();
        break;
      case 'ArrowLeft':
        camera.rotateY(0.1);
        tracerObj.updateCameraPose();
        break;
      case 'ArrowRight':
        camera.rotateY(-0.1);
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

      // NEW: Toggle perspective/orthographic with 'p'
      case 'p':
        // If your Camera class has toggleProjective():
        if (typeof camera.toggleProjective === 'function') {
          camera.toggleProjective();
        } else {
          // or do: camera._isProjective = !camera._isProjective;
          camera._isProjective = !camera._isProjective;
        }
        tracerObj.updateCameraPose();

        // Update the HUD text
        if (camera._isProjective) {
          currentCameraMode = "Projective";
        } else {
          currentCameraMode = "Orthographic";
        }
        refreshHudText();
        break;

      // NEW: Toggles for Light: 1=point, 2=directional, 3=spotlight
      case '1':
        tracerObj.updateLight(new PointLight());
        currentLight = "Point";
        refreshHudText();
        break;
      case '2':
        tracerObj.updateLight(new DirectionalLight());
        currentLight = "Directional";
        refreshHudText();
        break;
      case '3':
        tracerObj.updateLight(new SpotLight());
        currentLight = "Spotlight";
        refreshHudText();
        break;

      // NEW: Toggles for Shading: r=Lambertian, f=Phong, v=Toon
      //    (Assuming setShadingMode(0) => Lambert, 1 => Phong, 2 => Toon)
      case 'r':
        tracerObj.setShadingMode(0);
        currentShading = "Lambertian";
        refreshHudText();
        break;
      case 'f':
        tracerObj.setShadingMode(1);
        currentShading = "Phong";
        refreshHudText();
        break;
      case 'v':
        tracerObj.setShadingMode(2);
        currentShading = "Toon";
        refreshHudText();
        break;
    }
  });

  // 7) Simple on-screen text for FPS or usage instructions
  let fps = '??';

  function getInstructionText() {
    return `
Controls:
  W/S : Move fwd/back
  A/D : Move left/right
  Q/E : Move up/down
  Arrow Keys : Rotate camera
  Z/X : Roll camera
  P : Toggle camera mode (Currently = ${currentCameraMode})

Light [1..3]:
  1 => Point
  2 => Directional
  3 => Spotlight
  (Current = ${currentLight})

Shading [r/f/v]:
  r => Lambertian
  f => Phong
  v => Toon
  (Current = ${currentShading})

FPS: ${fps}
`;
  }

  const fpsText = new StandardTextObject(getInstructionText());

  function refreshHudText() {
    fpsText.updateText(getInstructionText());
  }

  // 8) Main render loop at ~60 FPS
  let frameCnt = 0;
  const tgtFPS = 60;
  const secPerFrame = 1.0 / tgtFPS;
  const frameInterval = secPerFrame * 1000;
  let lastCalled = Date.now();

  function renderFrame() {
    let elapsed = Date.now() - lastCalled;
    if (elapsed > frameInterval) {
      ++frameCnt;
      lastCalled = Date.now() - (elapsed % frameInterval);
      tracer.render();
    }
    requestAnimationFrame(renderFrame);
  }
  renderFrame();

  // 9) Update FPS display once a second
  setInterval(() => {
    fps = frameCnt.toString();
    frameCnt = 0;
    refreshHudText(); // also update the instructions text with new FPS
  }, 1000);

  return tracer;
}

init().then((ret) => {
  console.log("Ray tracer initialized:", ret);
}).catch((error) => {
  const pTag = document.createElement('p');
  pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
  document.body.appendChild(pTag);
  document.getElementById("renderCanvas")?.remove();
});
