// File: /lib/DSViz/GameOfLifeGrid.js

export default class GameOfLifeGrid {
    constructor(device, canvasFormat) {
      this._device = device;
      this._canvasFormat = canvasFormat;
      // Grid dimensions: 256 x 256 cells
      this.gridWidth = 2048;
      this.gridHeight = 2048;
      this.numCells = this.gridWidth * this.gridHeight;
      this._step = 0; // Used for ping–pong updates
      this._paused = false; // Internal flag to check if simulation is paused
      this._simSpeed = 60;  // Simulation updates per second (controlled internally)
    }
  
    async init() {
      // ------------------------------------------------
      // 1. Initialize the Cell States
      // ------------------------------------------------
      this._cellStateCPU = new Uint32Array(this.numCells);
      // First, set all cells randomly to alive (1) or dead (0)
      for (let i = 0; i < this.numCells; i++) {
        this._cellStateCPU[i] = Math.random() < 0.5 ? 1 : 0;
      }
      // Then, choose exactly 10 distinct random indices and set those cells to state 2 ("never dead")
      let everAliveIndices = new Set();
      while (everAliveIndices.size < 5000) {
        everAliveIndices.add(Math.floor(Math.random() * this.numCells));
      }
      for (let idx of everAliveIndices) {
        this._cellStateCPU[idx] = 2;
      }
      const bufferSize = this._cellStateCPU.byteLength;
      this._cellStateBuffers = [
        this._device.createBuffer({
          label: "Grid State Buffer A",
          size: bufferSize,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        }),
        this._device.createBuffer({
          label: "Grid State Buffer B",
          size: bufferSize,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        })
      ];
      // Write the initial state to the first buffer.
      this._device.queue.writeBuffer(this._cellStateBuffers[0], 0, this._cellStateCPU);
  
      // ------------------------------------------------
      // 2. Create a Uniform Buffer for the Camera Pose
      // (Assuming the camera pose is a 6-float array:
      //  [motor (4 floats), scale (2 floats)] )
      // ------------------------------------------------
      this._cameraPoseBuffer = this._device.createBuffer({
        label: "Grid Camera Pose Buffer",
        size: 6 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
  
      // Create the drag info buffer (16 bytes: 4 for isActive, 4 for cellIndex, 8 for offset)
      this._dragInfoBuffer = this._device.createBuffer({
        label: "Drag Info Buffer",
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
  
      // ------------------------------------------------
      // 3. Create the Compute Shader and Pipeline
      // ------------------------------------------------
      const computeShaderCode = `
        @group(0) @binding(0) var<storage, read> cellStateIn : array<u32>;
        @group(0) @binding(1) var<storage, read_write> cellStateOut : array<u32>;
  
        const gridWidth : u32 = ${this.gridWidth}u;
        const gridHeight : u32 = ${this.gridHeight}u;
  
        @compute @workgroup_size(16,16)
        fn computeMain(@builtin(global_invocation_id) global_id : vec3u) {
          let x = global_id.x;
          let y = global_id.y;
          if (x >= gridWidth || y >= gridHeight) { return; }
          let idx = y * gridWidth + x;
          
          // If the cell is "never dead" (state 2), leave it unchanged.
          if (cellStateIn[idx] == 2u) {
            cellStateOut[idx] = 2u;
            return;
          }
          
          var aliveCount : u32 = 0u;
          // Loop over the 3x3 neighborhood, skipping the cell itself.
          for (var j: i32 = -1; j <= 1; j = j + 1) {
            for (var i: i32 = -1; i <= 1; i = i + 1) {
              if (i == 0 && j == 0) { continue; }
              let nx = i32(x) + i;
              let ny = i32(y) + j;
              if (nx >= 0 && nx < i32(gridWidth) && ny >= 0 && ny < i32(gridHeight)) {
                // Count neighbors with state 1 or state 2 (treat never-dead as alive)
                let neighborState = cellStateIn[ny * i32(gridWidth) + nx];
                if (neighborState == 1u || neighborState == 2u) {
                  aliveCount = aliveCount + 1u;
                }
              }
            }
          }
          
          let current = cellStateIn[idx];
          // Apply Conway's rules (only for cells not marked as "never dead"):
          if (current == 1u) {
            if (aliveCount < 2u || aliveCount > 3u) {
              cellStateOut[idx] = 0u;
            } else {
              cellStateOut[idx] = 1u;
            }
          } else {
            if (aliveCount == 3u) {
              cellStateOut[idx] = 1u;
            } else {
              cellStateOut[idx] = 0u;
            }
          }
        }
      `;
      this._computeShaderModule = this._device.createShaderModule({
        label: "GameOfLife Compute Shader",
        code: computeShaderCode,
      });
      this._computePipeline = this._device.createComputePipeline({
        layout: "auto",
        compute: {
          module: this._computeShaderModule,
          entryPoint: "computeMain",
        }
      });
  
      // ------------------------------------------------
      // 4. Create the Vertex Buffer for a Cell Quad
      // ------------------------------------------------
      // A unit quad defined as a triangle strip (5 vertices) in model space.
      const cellQuadVertices = new Float32Array([
        -0.5, -0.5,
         0.5, -0.5,
        -0.5,  0.5,
         0.5,  0.5,
        -0.5, -0.5  // close the loop
      ]);
      this._vertexBuffer = this._device.createBuffer({
        label: "Cell Quad Vertex Buffer",
        size: cellQuadVertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this._device.queue.writeBuffer(this._vertexBuffer, 0, cellQuadVertices);
  
      // ------------------------------------------------
      // 5. Create the Render Shader and Pipeline
      // ------------------------------------------------
      // The vertex shader will:
      // - Compute the cell's center in world space.
      // - Scale the unit quad to the cell size.
      // - Apply a camera transformation using a uniform for the camera pose.
      const renderShaderCode = `
        @group(0) @binding(0) var<uniform> camerapose : Pose;
        @group(0) @binding(1) var<storage> cellState : array<u32>;
        @group(0) @binding(2) var<uniform> dragInfo : DragInfo;
  
        struct Pose {
          motor: MultiVector,
          scale: vec2f,
        };
  
        // Use a non-reserved name for drag info.
        struct DragInfo {
          isActive: u32,      // 0 means no drag; 1 means a cell is being dragged.
          cellIndex: u32,     // The instance index of the dragged cell.
          offset: vec2f,      // The drag offset (in world space) to add to that cell.
        };
  
        struct MultiVector {
          s: f32,
          e01: f32,
          eo0: f32,
          eo1: f32,
        };
  
        fn reverse(a: MultiVector) -> MultiVector {
          return MultiVector(a.s, -a.e01, -a.eo0, -a.eo1);
        }
  
        // Use the same transformation as the colored rectangle:
        fn applyMotorToPoint(p: vec2f, m: MultiVector) -> vec2f {
          // Subtract the camera translation
          return p - vec2f(m.eo1, m.eo0);
        }
  
        struct VertexOutput {
          @builtin(position) pos : vec4f,
          @interpolate(flat) @location(0) state : u32,
        };
  
        @vertex
        fn vertexMain(@location(0) pos : vec2f,
                      @builtin(instance_index) instanceId : u32) -> VertexOutput {
          // Define world-space extent: let the grid span from -L to L.
          let L : f32 = 1.0;
          let gridWidth : u32 = ${this.gridWidth}u;
          let x = instanceId % gridWidth;
          let y = instanceId / gridWidth;
          let cellWidth = (2.0 * L) / f32(gridWidth);
          let cellHeight = (2.0 * L) / f32(gridWidth);
          let centerX = -L + (f32(x) + 0.5) * cellWidth;
          let centerY = -L + (f32(y) + 0.5) * cellHeight;
          let scaledPos = pos * vec2f(cellWidth, cellHeight);
          var worldPos = vec2f(centerX + scaledPos.x, centerY + scaledPos.y);
          // Apply camera transformation.
          let transformed = applyMotorToPoint(worldPos, camerapose.motor);
          var finalPos = transformed * camerapose.scale;
          if (dragInfo.isActive == 1u && instanceId == dragInfo.cellIndex) {
            finalPos = finalPos + dragInfo.offset;
          }
          var out : VertexOutput;
          out.pos = vec4f(finalPos, 0.0, 1.0);
          out.state = cellState[instanceId];
          return out;
        }
  
        @fragment
        fn fragmentMain(@interpolate(flat) @location(0) state : u32) -> @location(0) vec4f {
          // Render "never dead" cells (state 2) in green.
          if (state == 2u) {
            return vec4f(0.0, 1.0, 0.0, 1.0);
          } else if (state == 1u) {
            return vec4f(1.0, 1.0, 1.0, 1.0);
          } else {
            return vec4f(0.0, 0.0, 0.0, 1.0);
          }
        }
      `;
      this._renderShaderModule = this._device.createShaderModule({
        label: "GameOfLife Render Shader",
        code: renderShaderCode,
      });
      this._renderPipeline = this._device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: this._renderShaderModule,
          entryPoint: "vertexMain",
          buffers: [{
            arrayStride: 2 * 4, // Two 32-bit floats per vertex.
            attributes: [{
              shaderLocation: 0,
              offset: 0,
              format: "float32x2"
            }]
          }]
        },
        fragment: {
          module: this._renderShaderModule,
          entryPoint: "fragmentMain",
          targets: [{
            format: this._canvasFormat
          }]
        },
        primitive: {
          topology: "triangle-strip"
        }
      });
      // Create the initial render bind group with three entries.
      this._renderBindGroup = this._device.createBindGroup({
        layout: this._renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this._cameraPoseBuffer } },
          { binding: 1, resource: { buffer: this._cellStateBuffers[this._step % 2] } },
          { binding: 2, resource: { buffer: this._dragInfoBuffer } }
        ]
      });
    }
  
    // ------------------------------------------------
    // Update the grid simulation by dispatching the compute shader.
    // ------------------------------------------------
    update() {
      const commandEncoder = this._device.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(this._computePipeline);
      const inputBuffer = this._cellStateBuffers[this._step % 2];
      const outputBuffer = this._cellStateBuffers[(this._step + 1) % 2];
      // Compute bind group: only include bindings 0 and 1 (drag info is not used in compute)
      const computeBindGroup = this._device.createBindGroup({
        layout: this._computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputBuffer } },
          { binding: 1, resource: { buffer: outputBuffer } }
        ]
      });
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(this.gridWidth / 16),
        Math.ceil(this.gridHeight / 16)
      );
      

      computePass.dispatchWorkgroups(16, 16);
      computePass.end();
      this._device.queue.submit([commandEncoder.finish()]);
      this._step++;
      // Update the render bind group to use the latest cell state buffer.
      const latestBuffer = this._cellStateBuffers[this._step % 2];
      this._renderBindGroup = this._device.createBindGroup({
        layout: this._renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this._cameraPoseBuffer } },
          { binding: 1, resource: { buffer: latestBuffer } },
          { binding: 2, resource: { buffer: this._dragInfoBuffer } }
        ]
      });
    }
  
    // ------------------------------------------------
    // Render the grid using instanced drawing.
    // ------------------------------------------------
    render(passEncoder) {
      passEncoder.setPipeline(this._renderPipeline);
      passEncoder.setBindGroup(0, this._renderBindGroup);
      passEncoder.setVertexBuffer(0, this._vertexBuffer);
      passEncoder.draw(5, this.numCells);
    }
  
    // ------------------------------------------------
    // Update the camera uniform with the current camera pose.
    // ------------------------------------------------
    updateCameraUniform(cameraPose) {
      this._device.queue.writeBuffer(this._cameraPoseBuffer, 0, cameraPose);
    }
  
    // ------------------------------------------------
    // Reset the simulation: reinitialize cell states randomly and reset the step counter.
    // ------------------------------------------------
    reset() {
      for (let i = 0; i < this.numCells; i++) {
        // Set all cells randomly to 1 or 0...
        this._cellStateCPU[i] = Math.random() < 0.5 ? 1 : 0;
      }
      // Then pick 10 distinct random indices and set those cells to 2 (ever alive)
      let everAliveIndices = new Set();
      while (everAliveIndices.size < 5000) {
        everAliveIndices.add(Math.floor(Math.random() * this.numCells));
      }
      for (let idx of everAliveIndices) {
        this._cellStateCPU[idx] = 2;
      }
      this._device.queue.writeBuffer(this._cellStateBuffers[0], 0, this._cellStateCPU);
      this._step = 0;
    }
  
    // ------------------------------------------------
    // Provide an updateGeometry() method to satisfy the renderer.
    // ------------------------------------------------
    updateGeometry() {
      // No CPU-side geometry update is needed for the grid.
    }
  
    // ------------------------------------------------
    // Provide a compute() method; if the grid is paused, skip updating.
    // ------------------------------------------------
    compute() {
      if (!this._lastComputeTime) {
        this._lastComputeTime = Date.now();
      }
      const now = Date.now();
      const updateInterval = 1000 / this._simSpeed; // ms per update based on internal speed
      if (now - this._lastComputeTime >= updateInterval && !this._paused) {
        this.update();
        this._lastComputeTime = now;
      }
    }
  }
  