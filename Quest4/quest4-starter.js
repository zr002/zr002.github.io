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

import Renderer from '/lib/Viz/2DRenderer.js'
import ParticleSystemObject from '/lib/DSViz/ParticleSystemObject.js'
import StandardTextObject from '/lib/DSViz/StandardTextObject.js'
import MassSpringSystemObject from '/lib/DSViz/MassSpringSystemObject.js';

async function init() {
  // Create a canvas tag
  const canvasTag = document.createElement('canvas');
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);
  // Create a 2d animated renderer
  const renderer = new Renderer(canvasTag);
  await renderer.init();
  const particles = new ParticleSystemObject(renderer._device, renderer._canvasFormat);
  await renderer.appendSceneObject(particles);

  const massSpring = new MassSpringSystemObject(renderer._device, renderer._canvasFormat, 16);
  await renderer.appendSceneObject(massSpring);

  let fps = '??';
  var fpsText = new StandardTextObject("Click on the waterfall to see particle splash!\nfps: " + fps);
  
  // NEW ADDITION: Reposition the instructions text so it doesn't overlap with the fps.
  fpsText._textCanvas.style.top = "50px";  // moves the overlay down by 50px

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
      renderer.render();
    }
    requestAnimationFrame(renderFrame);
  };
  lastCalled = Date.now();
  renderFrame();
  setInterval(() => { 
    fpsText.updateText("Click on the waterfall to see particle splash!\nfps: " + frameCnt);
    frameCnt = 0;
  }, 1000); // call every 1000 ms
  
  // ADD: Mouse event listeners to update the mouse uniform
  canvasTag.addEventListener('mousedown', (e) => {
    const rect = canvasTag.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    console.log("mousedown at:", x, y);
    particles.updateMouseState(x, y, true);
  });
  
  canvasTag.addEventListener('mouseup', () => {
    console.log("mouseup");
    particles.updateMouseState(0, 0, false);
  });
  
  // NEW ADDITION: Keyboard event listener to toggle wind for the mass–spring system.
  // Press "W" to toggle wind on/off.
  let windOn = false;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') {
      windOn = !windOn;
      console.log("Wind toggled:", windOn);
      massSpring.setWindEnabled(windOn);
    }
  });
  
  return renderer;
}

init().then(ret => {
  console.log(ret);
}).catch(error => {
  const pTag = document.createElement('p');
  pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
  document.body.appendChild(pTag);
  document.getElementById("renderCanvas").remove();
});
