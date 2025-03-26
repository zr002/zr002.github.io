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
 *                 and indicate if changes were made.
 *  - NonCommerical: You may not use the material for commerical purposes.
 *  - No additional restrictions: You may not apply legal terms or technological 
 *                                measures that legally restrict others from doing
 *                                anything the license permits.
 */

import Renderer from '/Quest5/lib/Viz/2DRenderer.js';
import PolygonObject from '/Quest5/lib/DSViz/PolygonObject.js';
import StandardTextObject from '/Quest5/lib/DSViz/StandardTextObject.js';
import TwoDGridSegmented from '/Quest5/lib/DS/TwoDGridSegmented.js';
import { gpuGridQuery } from '/Quest5/gpuGridQuery.js';

// Global flag to toggle grid mode (CPU or GPU)
let useGPU = false;

async function init() {
  // Create and size the canvas.
  const canvasTag = document.createElement('canvas');
  canvasTag.id = "renderCanvas";
  canvasTag.width = window.innerWidth;
  canvasTag.height = window.innerHeight;
  document.body.appendChild(canvasTag);
  // Global reference for canvas.
  window.renderCanvas = canvasTag;

  // Create and initialize the renderer.
  const renderer = new Renderer(canvasTag);
  await renderer.init();

  let gridDataBuffer;

  // Array of available shape files.
  const shapeFiles = [
    '/assets/box.polygon',
    '/assets/circle.polygon',
    '/assets/dense.polygon',
    '/assets/human.polygon',
    '/assets/star.polygon'
  ];
  let currentShapeIndex = 0;

  // Create the initial polygon scene object.
  let polygon = new PolygonObject(
    renderer._device,
    renderer._canvasFormat,
    shapeFiles[currentShapeIndex]
  );
  await renderer.appendSceneObject(polygon);

  // Build the CPU grid for collision acceleration.
  const gridSize = 64;
  let grid = new TwoDGridSegmented(polygon._polygon._polygon, gridSize);
  await grid.init();
  console.log("2D Grid (CPU) initialized", grid);

  // Create GPU grid data from the CPU grid.
  // Convert cell types to a Uint32Array (INTERIOR = 1, others = 0).
  let cellTypes = new Uint32Array(gridSize * gridSize);
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const type = grid._cells[r][c][2];
      cellTypes[r * gridSize + c] = (type === TwoDGridSegmented.INTERIOR) ? 1 : 0;
    }
  }
  gridDataBuffer = renderer._device.createBuffer({
    size: cellTypes.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(gridDataBuffer.getMappedRange()).set(cellTypes);
  gridDataBuffer.unmap();

  // --- Create a single overlay text object for instructions, FPS, and grid mode ---
  let currentFPS = "??";
  function updateOverlay() {
    const gridMode = useGPU ? "GPU" : "CPU";
    const text = `Press 'N' to change shape.
Press 'G' to toggle grid mode.
Current Shape: ${shapeFiles[currentShapeIndex]}
Current Grid: ${gridMode}
FPS: ${currentFPS}`;
    fpsText.updateText(text);
  }
  const fpsText = new StandardTextObject(
    `Press 'N' to change shape.
Press 'G' to toggle grid mode.
Current Shape: ${shapeFiles[currentShapeIndex]}
Current Grid: CPU
FPS: ${currentFPS}`
  );
  await renderer.appendSceneObject(fpsText);

  // Track mouse position.
  let mousePos = { x: 0, y: 0 };
  document.addEventListener('mousemove', async (evt) => {
    const rect = canvasTag.getBoundingClientRect();
    mousePos.x = evt.clientX - rect.left;
    mousePos.y = evt.clientY - rect.top;
    if (polygon && typeof polygon.setMousePos === 'function') {
      polygon.setMousePos(mousePos.x, mousePos.y);
    }
    // Convert mouse position to grid coordinate system.
    const canvasWidth = canvasTag.width;
    const canvasHeight = canvasTag.height;
    const px = (mousePos.x / canvasWidth) * 4.0 - 1.0;
    const py = 1.0 - (mousePos.y / canvasHeight) * 4.0;
    console.log("x position:",px);
    console.log("y position:",py);
    // Use either the GPU or CPU grid for collision query.
    if (useGPU) {
      // Set up grid parameters for the GPU query.
      const gridParams = {
        gridSize: gridSize,
        minX: grid._boundingBox[0],
        minY: grid._boundingBox[1],
        cellWidth: grid._dx,
        cellHeight: grid._dy,
        queryX: px,
        queryY: py,
      };
      const isInside = await gpuGridQuery(renderer._device, gridDataBuffer, gridParams);
    } else {
      const isInside = !grid.isOutsideAssumeLocalConvex([px, py]);
    }
  });

  // Listen for key input to toggle grid mode and switch shapes.
  document.addEventListener('keydown', async (evt) => {
    if (evt.key.toLowerCase() === 'n') {
      // Cycle through shapes.
      currentShapeIndex = (currentShapeIndex + 1) % shapeFiles.length;
      console.log("Switching to shape:", shapeFiles[currentShapeIndex]);
      renderer._objects = [];
      polygon = new PolygonObject(
        renderer._device,
        renderer._canvasFormat,
        shapeFiles[currentShapeIndex]
      );
      await renderer.appendSceneObject(polygon);
      // Rebuild the CPU grid.
      grid = new TwoDGridSegmented(polygon._polygon._polygon, gridSize);
      await grid.init();
      // Recreate the GPU grid buffer from new grid data.
      cellTypes = new Uint32Array(gridSize * gridSize);
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const type = grid._cells[r][c][2];
          cellTypes[r * gridSize + c] = (type === TwoDGridSegmented.INTERIOR) ? 1 : 0;
        }
      }
      const newGridDataBuffer = renderer._device.createBuffer({
        size: cellTypes.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Uint32Array(newGridDataBuffer.getMappedRange()).set(cellTypes);
      newGridDataBuffer.unmap();
      // Replace the old GPU grid buffer.
      gridDataBuffer.destroy(); // Optional: clean up old buffer.
      // Note: For simplicity, we reassign gridDataBuffer (if declared with let).
      // If gridDataBuffer was declared with const, you would need to use a different variable.
      // For this example, assume gridDataBuffer is declared with let.
      gridDataBuffer = newGridDataBuffer;
      updateOverlay();
      await renderer.appendSceneObject(fpsText);
    } else if (evt.key.toLowerCase() === 'g') {
      // Toggle grid mode between CPU and GPU.
      useGPU = !useGPU;
      console.log("Toggled grid mode. Now using:", useGPU ? "GPU" : "CPU");
      updateOverlay();
    }
  });

  // Render loop: update at approximately 60 FPS.
  let frameCnt = 0;
  const tgtFPS = 60;
  const secPerFrame = 1 / tgtFPS;
  const frameInterval = secPerFrame * 1000;
  let lastTime = Date.now();

  function renderFrame() {
    let currentTime = Date.now();
    let dt = (currentTime - lastTime) / 1000; // dt in seconds.
    lastTime = currentTime;
    polygon.setMousePos(mousePos.x, mousePos.y);
    // (Insert physics or collision updates if needed.)
    renderer.render();
    frameCnt++;
    requestAnimationFrame(renderFrame);
  }
  requestAnimationFrame(renderFrame);

  // Update the FPS overlay once per second.
  setInterval(() => {
    currentFPS = frameCnt;
    updateOverlay();
    frameCnt = 0;
  }, 1000);

  return renderer;
}

init().then((ret) => {
  console.log("Renderer initialized:", ret);
}).catch((error) => {
  const pTag = document.createElement('p');
  pTag.innerHTML = navigator.userAgent + "<br>" + error.message;
  document.body.appendChild(pTag);
  const canvasEl = document.getElementById("renderCanvas");
  if (canvasEl) canvasEl.remove();
});
