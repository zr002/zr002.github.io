/*!
 * Copyright (c) 2025 SingChun LEE @ Bucknell University.
 * CC BY-NC 4.0. (See license details in the header.)
 */

import Renderer from '/lib/Viz/2DRenderer.js';
import Camera from '/lib/Viz/2DCamera.js';
// Use the compute-shader–driven Game of Life grid.
import GameOfLifeGrid from '/lib/DSViz/GameOfLifeGrid.js';
import StandardTextObject from '/lib/DSViz/StandardTextObject.js';
import PGA2D from '/lib/Math/PGA2D.js';
import Standard2DPGACameraSceneObject from '/lib/DSViz/Standard2DPGACameraSceneObject.js';
let dragActive = false;
let dragCellIndex = 0;
let dragInitialMouse = [0, 0]; // store the initial mouse position (in normalized device coordinates)
let toggleCount = 0;  // Declare this at the top level of your main script

function toggleCell(e, camera, golGrid) {

  // Step 1: Compute normalized device coordinates (NDC)
  const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
  const ndcY = (-e.clientY / window.innerHeight) * 2 + 1;
  
  // Step 2: Convert NDC to world coordinates.
  // For our grid, we assume the grid spans from -1 to 1.
  // We use the camera’s scale and translation.  
  // (This conversion must match how your vertex shader applies the camera.)
  const scale = camera._pose[4] || 1; // assuming _pose[4] is the scale factor
  // Because in the vertex shader we do:
  //    transformed = applyMotorToPoint(worldPos, camerapose.motor)
  // and our applyMotorToPoint subtracts the translation stored in camerapose.motor,
  // we assume the camera’s translation (in our CPU code) is stored in camera._pose[1] and [2].
  // To reverse that (i.e. to get the world coordinate), we add them back.
  const worldX = (ndcX / scale) + camera._pose[1];
  const worldY = (ndcY / scale) + camera._pose[2];
  
  // Step 3: Map world coordinates to grid cell indices.
  // Our grid spans from -1 to 1 in X and Y, so total width = 2.
  const cellWidth = 2 / golGrid.gridWidth;   // cell width in world units
  const cellHeight = 2 / golGrid.gridHeight;   // cell height in world units
  // Compute column and row indices:
  const col = Math.floor((worldX + 1) / cellWidth);
  const row = Math.floor((worldY + 1) / cellHeight);
  // Compute the instance (cell) index:
  const index = row * golGrid.gridWidth + col;
  
  console.log(`Toggle click: world=(${worldX.toFixed(2)},${worldY.toFixed(2)}) -> cell [row=${row}, col=${col}, index=${index}]`);
  console.log("Cell state before toggle:", golGrid._cellStateCPU[index]);
  // Step 4: Check if the cell is toggleable (we ignore never-dead cells, state 2).
  if (golGrid._cellStateCPU[index] === 2) {
    console.log("Cell is never dead; toggling is disabled for this cell.");
    return;
  }

  // Toggle state: if alive (1) then set to dead (0); if dead (0) then set to alive (1)
  const newState = (golGrid._cellStateCPU[index] === 1) ? 0 : 1;
  golGrid._cellStateCPU[index] = newState;
  console.log(`Toggled cell ${index} to state ${newState}`);

  // Step 5: Update the GPU buffer. (For simplicity, we update the first cell state buffer.)
  // In a real application, you might update both or handle ping-pong buffering.

  // For cellIndex, the byte offset is cellIndex * 4 (since each cell is a u32).
  let offsetBytes = index * 4;
  let value = new Uint32Array([newState]);
  golGrid._device.queue.writeBuffer(
    golGrid._cellStateBuffers[0],
    offsetBytes,
    value
  );

}

async function init() {
  // ==================================================
  // 1. Create Canvas & Renderer
  // ==================================================
  const canvasTag = document.createElement('canvas');
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);
  const renderer = new Renderer(canvasTag);
  await renderer.init();

  

  // ==================================================
  // 2. Create Camera
  // ==================================================
  const camera = new Camera();


  // ==================================================
  // 3. Instantiate the Game of Life Grid (256×256)
  // ==================================================
  const golGrid = new GameOfLifeGrid(renderer._device, renderer._canvasFormat);
  await golGrid.init();
  await renderer.appendSceneObject(golGrid);



  // ==================================================
  // 5. Create Text Overlays
  // ==================================================
  // FPS text overlay
  let fpsText = new StandardTextObject('fps: ' + "??");
  // Interaction instructions overlay
  let instructionsText = new StandardTextObject(
    "Controls:\n" +
    "Arrow Keys / WASD: Move camera\n" +
    "Q/E: Zoom in/out\n" +
    "P: Pause/Resume simulation\n" +
    "R: Reset simulation\n" +
    "Z: Slow simulation\n" +
    "X: Speed up simulation\n" +
    "F: Toggle FPS overlay\n" +
    "Drag quad with mouse",
    5, "18px Arial"
  );
  instructionsText._textCanvas.style.top = "50px";
  instructionsText._textCanvas.style.left = "10px";


  // ==================================================
  // 6. Global Simulation Control Variables
  // ==================================================
  let simulationPaused = false; // false means simulation is running
  let simSpeed = 60;            // Simulation update rate in updates per second

  // ==================================================
  // 7. Keyboard Event Handling
  // ==================================================
  var movespeed = 0.05;
  window.addEventListener("keydown", (e) => {
    switch(e.key) {
      case 'ArrowUp': case 'w': case 'W':
        camera.moveUp(movespeed);
        if (golGrid.updateCameraUniform) golGrid.updateCameraUniform(camera._pose);
        break;
      case 'ArrowDown': case 's': case 'S':
        camera.moveDown(movespeed);
        if (golGrid.updateCameraUniform) golGrid.updateCameraUniform(camera._pose);
        break;
      case 'ArrowLeft': case 'a': case 'A':
        camera.moveLeft(movespeed);
        if (golGrid.updateCameraUniform) golGrid.updateCameraUniform(camera._pose);
        break;
      case 'ArrowRight': case 'd': case 'D':
        camera.moveRight(movespeed);
        if (golGrid.updateCameraUniform) golGrid.updateCameraUniform(camera._pose);
        break;
      case 'q': case 'Q':
        camera.zoomIn();
        if (golGrid.updateCameraUniform) golGrid.updateCameraUniform(camera._pose);
        break;
      case 'e': case 'E':
        camera.zoomOut();
        if (golGrid.updateCameraUniform) golGrid.updateCameraUniform(camera._pose);
        break;
      case 'f': case 'F':
        fpsText.toggleVisibility();
        break;
      case 'p': case 'P':
        simulationPaused = !simulationPaused;
        golGrid._paused = simulationPaused;
        console.log("Simulation paused:", simulationPaused);
        break;
      case 'r': case 'R':
        if (golGrid.reset) { golGrid.reset(); }
        break;
      // In your key handler for speed adjustments:
      case 'z': case 'Z':
        simSpeed = Math.max(1, simSpeed - 10);
        console.log("Simulation speed slowed to " + simSpeed + " updates/sec");
        golGrid._simSpeed = simSpeed; // Propagate the speed value to the grid
        break;
      case 'x': case 'X':
        simSpeed = Math.min(240, simSpeed + 10);
        console.log("Simulation speed increased to " + simSpeed + " updates/sec");
        golGrid._simSpeed = simSpeed; // Propagate the speed value to the grid
        break;

          }
  });

  // ==================================================
  // 8. Mouse Drag Handling for Movable Quad
  // ==================================================
  let isDragging = false;
  let oldP = [0, 0];

  canvasTag.addEventListener('click', (e) => {
    // Optionally, if dragging is active, skip toggling:
    if (dragActive) return;
    toggleCell(e, camera, golGrid);
  });



  

  // ==================================================
  // 9. Animation Loop & FPS / Simulation Update Logging
  // ==================================================
  var frameCnt = 0;
  const tgtFPS = 60;
  const secPerFrame = 1.0 / tgtFPS;
  const frameInterval = secPerFrame * 1000;
  let lastCalled = Date.now();

  let renderFrame = () => {
    let now = Date.now();
    let elapsed = now - lastCalled;
    if (elapsed > frameInterval) {
      frameCnt++;
      lastCalled = now - (elapsed % frameInterval);

      // Always update the grid's camera uniform so that zoom and pan are applied.
      if (golGrid.updateCameraUniform) {
        golGrid.updateCameraUniform(camera._pose);
      }
      renderer.render();
    }
    requestAnimationFrame(renderFrame);
  };

  renderFrame();

  // Update the FPS text overlay once per second.
  setInterval(() => {
    fpsText.updateText('fps: ' + frameCnt);
    frameCnt = 0;
  }, 1000);


  return renderer;
}

init().then(ret => {
  console.log("Initialization complete:", ret);
}).catch(error => {
  const pTag = document.createElement('p');
  pTag.innerHTML = navigator.userAgent + "<br>" + error.message;
  document.body.appendChild(pTag);
  document.getElementById("renderCanvas").remove();
});
