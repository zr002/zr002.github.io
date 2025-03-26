/*!
 * Copyright (c) 2025 SingChun LEE @ Bucknell University. CC BY-NC 4.0.
 * 
 * This code is provided mainly for educational purposes at Bucknell University.
 *
 * (License text unchanged)
 */

import SceneObject from "/Quest5/lib/DSViz/SceneObject.js";
import Polygon from "/Quest5/lib/DS/Polygon.js";

export default class PolygonObject extends SceneObject {
  constructor(device, canvasFormat, filename) {
    super(device, canvasFormat);
    this._polygon = new Polygon(filename);
    
    // Existing properties
    this._mouseX = 0;
    this._mouseY = 0;
    this._isConvex = (filename.includes("box") || filename.includes("circle"));
    this._colorData = new Float32Array([0.9333, 0.4627, 0.1373, 1.0]);
    
    // NEW: Gravity and floor settings
    this._gravity = [0, -0.5];  // Adjust gravity strength as needed.
    this._floorY = -0.8;        // Floor level (in the same normalized coordinate system).
    
    // NEW: Will hold per-vertex velocities.
    this._velocities = [];
    // NEW: Will hold the original vertex positions (for ARAP)
    this._originalPositions = [];
    
    // NEW: ARAP iterations per frame (adjust as needed)
    this._arapIterations = 5;
  }
  
  async createGeometry() {
    // Read vertices from polygon file and normalize.
    await this._polygon.init();
    this._numV = this._polygon._numV;
    this._dim = this._polygon._dim;
    this._vertices = this._polygon._polygon.flat();
    
    // NEW: Store a deep copy of the original positions.
    // Here, we assume _polygon._polygon is an array of [x,y] arrays.
    this._originalPositions = this._polygon._polygon.map(v => [...v]);
    
    // NEW: Initialize velocities for each vertex (2D).
    this._velocities = new Array(this._numV).fill(0).map(() => [0, 0]);
    
    // Create GPU buffer for vertex positions.
    this._vertexBuffer = this._device.createBuffer({
      label: "Vertices for " + this.getName(),
      size: this._vertices.length * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this._vertexBuffer.getMappedRange()).set(this._vertices);
    this._vertexBuffer.unmap();
    
    // Define vertex buffer layout.
    this._vertexBufferLayout = {
      arrayStride: this._dim * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        {
          format: "float32x" + this._dim.toString(),
          offset: 0,
          shaderLocation: 0,
        },
      ],
    };
    
    // Create uniform buffer for color.
    this._colorBuffer = this._device.createBuffer({
      size: this._colorData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this._device.queue.writeBuffer(
      this._colorBuffer,
      0,
      this._colorData.buffer,
      this._colorData.byteOffset,
      this._colorData.byteLength
    );
  }
  
  async createShaders() {
    let shaderCode = await this.loadShader("/Quest5/shaders/standard2d.wgsl");
    this._shaderModule = this._device.createShaderModule({
      label: "Shader " + this.getName(),
      code: shaderCode,
    });
  }
  
  async createRenderPipeline() {
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Render Pipeline " + this.getName(),
      layout: "auto",
      vertex: {
        module: this._shaderModule,
        entryPoint: "vertexMain",
        buffers: [this._vertexBufferLayout],
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentMain",
        targets: [{
          format: this._canvasFormat,
        }],
      },
      primitive: {
        topology: "line-strip",
      },
    });
    
    // Get the bind group layout (index 0) and create the bind group.
    const bindGroupLayout = this._renderPipeline.getBindGroupLayout(0);
    this._bindGroup = this._device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this._colorBuffer },
      }],
    });
  }
  
  async createComputePipeline() {}
  compute(pass) {}
  
  // NEW: Update physics: apply gravity and floor collision.
  updatePhysics(dt) {
    if (!this._polygon || !this._polygon._polygon) {
      console.warn("updatePhysics skipped: polygon data not available yet.");
      return;
    }
    for (let i = 0; i < this._numV; i++) {
      // Update vertical velocity: v_y = v_y + gravity * dt.
      this._velocities[i][1] += this._gravity[1] * dt;
      
      // Update vertex position: pos = pos + velocity * dt.
      // Note: _polygon._polygon[i] is [x,y].
      this._polygon._polygon[i][0] += this._velocities[i][0] * dt;
      this._polygon._polygon[i][1] += this._velocities[i][1] * dt;
      if (this._polygon._polygon[i][1] < this._floorY) {
        this._polygon._polygon[i][1] = this._floorY;
        this._velocities[i][1] = 0;
      }
      
    }
    this._vertices = this._polygon._polygon.flat();
    // Write updated vertices to the GPU.
    this._device.queue.writeBuffer(
      this._vertexBuffer,
      0,
      new Float32Array(this._vertices)
    );
  }
  
  // A helper function to flatten an array (if Array.flat() is not supported)
flatten(arr) {
  return arr.reduce((acc, val) => acc.concat(val), []);
}

// NEW: PBD-based update method.
// This method enforces distance constraints along each edge (between consecutive vertices)
// to maintain the original edge lengths (computed from the original rest shape).
// It assumes the polygon is closed (the last vertex is a duplicate of the first).
updatePBD() {
  // Guard clause: ensure the polygon's vertex array is available.
  if (!this._polygon || !this._polygon._polygon) {
    console.warn("updatePBD: Polygon vertex data not available.");
    return;
  }
  
  // Assume the polygon is closed.
  // uniqueCount: the number of unique vertices (last is duplicate of the first)
  const uniqueCount = this._numV - 1;
  
  // If not already computed, compute rest edge lengths from the original positions.
  if (!this._restEdgeLengths) {
    this._restEdgeLengths = [];
    for (let i = 0; i < uniqueCount; i++) {
      const nextIdx = (i + 1) % uniqueCount;
      const p1 = this._originalPositions[i];
      const p2 = this._originalPositions[nextIdx];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      this._restEdgeLengths.push(len);
    }
  }
  
  // Compute rest angles for each vertex if not already computed.
  if (!this._restAngles) {
    this._restAngles = [];
    for (let i = 0; i < uniqueCount; i++) {
      const prevIdx = (i - 1 + uniqueCount) % uniqueCount;
      const nextIdx = (i + 1) % uniqueCount;
      // Compute angle at vertex i (from previous to next) in rest shape.
      const v1 = [
        this._originalPositions[i][0] - this._originalPositions[prevIdx][0],
        this._originalPositions[i][1] - this._originalPositions[prevIdx][1]
      ];
      const v2 = [
        this._originalPositions[nextIdx][0] - this._originalPositions[i][0],
        this._originalPositions[nextIdx][1] - this._originalPositions[i][1]
      ];
      let angle1 = Math.atan2(v1[1], v1[0]);
      let angle2 = Math.atan2(v2[1], v2[0]);
      let restAngle = angle2 - angle1;
      while (restAngle > Math.PI) restAngle -= 2 * Math.PI;
      while (restAngle < -Math.PI) restAngle += 2 * Math.PI;
      this._restAngles.push(restAngle);
    }
  }
  
  // Set default stiffness and iteration parameters (tune as needed)
  if (this._pbdIterations === undefined) this._pbdIterations = 1000;
  if (this._distanceStiffness === undefined) this._distanceStiffness = 0.50;
  if (this._angleStiffness === undefined) this._angleStiffness = 0.1;
  
  const iterations = this._pbdIterations;
  
  // Helper functions.
  const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const scale = (v, s) => [v[0] * s, v[1] * s];
  const length = (v) => Math.hypot(v[0], v[1]);
  const normalize = (v) => {
    const len = length(v);
    return len > 0 ? [v[0] / len, v[1] / len] : [0, 0];
  };
  
  // Iteratively enforce constraints.
  for (let iter = 0; iter < iterations; iter++) {
    // --- Distance Constraint Projection ---
    for (let i = 0; i < uniqueCount; i++) {
      const j = (i + 1) % uniqueCount;
      const p_i = this._polygon._polygon[i];
      const p_j = this._polygon._polygon[j];
      
      const edgeVec = subtract(p_j, p_i);
      const currentLen = length(edgeVec);
      const restLen = this._restEdgeLengths[i];
      if (currentLen === 0) continue;
      const diff = currentLen - restLen;
      // Correction vector (assuming equal masses; each gets half correction).
      const correction = scale(normalize(edgeVec), 0.5 * this._distanceStiffness * diff);
      
      // Apply corrections.
      p_i[0] += correction[0];
      p_i[1] += correction[1];
      p_j[0] -= correction[0];
      p_j[1] -= correction[1];
    }
    
    // --- Angle Constraint Projection ---
    for (let i = 0; i < uniqueCount; i++) {
      const prevIdx = (i - 1 + uniqueCount) % uniqueCount;
      const nextIdx = (i + 1) % uniqueCount;
      
      const p_prev = this._polygon._polygon[prevIdx];
      const p_curr = this._polygon._polygon[i];
      const p_next = this._polygon._polygon[nextIdx];
      
      const v1 = subtract(p_curr, p_prev);
      const v2 = subtract(p_next, p_curr);
      
      let currAngle = Math.atan2(v2[1], v2[0]) - Math.atan2(v1[1], v1[0]);
      while (currAngle > Math.PI) currAngle -= 2 * Math.PI;
      while (currAngle < -Math.PI) currAngle += 2 * Math.PI;
      
      const restAngle = this._restAngles[i];
      const angleError = currAngle - restAngle;
      
      // For correction, compute an average of the two current edge directions.
      const avgDir = normalize(add(normalize(v1), normalize(v2)));
      // Perpendicular to avgDir.
      const perpDir = [-avgDir[1], avgDir[0]];
      
      // Apply correction to current vertex proportional to angle error.
      p_curr[0] -= this._angleStiffness * angleError * perpDir[0];
      p_curr[1] -= this._angleStiffness * angleError * perpDir[1];
    }
  }
  
  // Ensure the polygon remains closed.
  this._polygon._polygon[uniqueCount] = [...this._polygon._polygon[0]];
  
  // Flatten the vertex array and update GPU.
  this._vertices = this._polygon._polygon.flat();
  this._device.queue.writeBuffer(
    this._vertexBuffer,
    0,
    new Float32Array(this._vertices)
  );
}


  
  setMousePos(x, y) {
    this._mouseX = x;
    this._mouseY = y;
  }
  
  
  // Existing render method, with collision feedback code retained.
  render(pass) {
    // Get the canvas dimensions from the global reference.
    const canvas = window.renderCanvas;
    if (!canvas) return;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Convert mouse coordinates to normalized device coordinates.
    const px = (this._mouseX / canvasTag.clientWidth) * 2 - 1;
    const py = 1 - (this._mouseY / canvasTag.clientHeight) * 2;
    
    // Determine collision using the appropriate method.
    let inside = false;
    if (this._isConvex) {
      inside = this._polygon.isInsideConvex(px, py);
    } else {
      inside = this._polygon.isInsideWinding(px, py);
    }
    
    // Change color based on collision.
    if (inside) {
      this._colorData.set([0.0, 1.0, 0.0, 1.0]);  // Green if inside.
    } else {
      this._colorData.set([0.9333, 0.4627, 0.1373, 1.0]);  // Orange otherwise.
    }
    this._device.queue.writeBuffer(
      this._colorBuffer,
      0,
      this._colorData.buffer,
      this._colorData.byteOffset,
      this._colorData.byteLength
    );
    
    // Render the polygon.
    pass.setPipeline(this._renderPipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.draw(this._numV);
  }
  
  // Provide empty updateGeometry() so the renderer can call it.
  updateGeometry() {}
  
  // You can also add an empty compute() if needed.
  compute(pass) {}
}
