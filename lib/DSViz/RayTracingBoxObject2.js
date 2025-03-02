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

import RayTracingObject from "/lib/DSViz/RayTracingObject.js"
import UnitCube from "/lib/DS/UnitCube2.js"

export default class RayTracingBoxObject extends RayTracingObject {
  constructor(device, canvasFormat, camera, showTexture = true) {
    super(device, canvasFormat);
    this._box = new UnitCube();
    this._camera = camera;
    this._showTexture = showTexture;
    
    // --- New: extra shape data definitions ---
    // Cube: a smaller cube inside the box
    this._cubeData = {
      center: [0.0, 0.0, 0.0, 0.0],  // vec4; w unused
      halfSize: 0.08
    };
    // Sphere: a sphere positioned somewhere inside the scene
    this._sphereData = {
      center: [0.15, 0.0, 0.0, 0.0],  // vec4; w unused
      radius: 0.1
    };
    // Cylinder: assumed vertical (aligned with y-axis)
    this._cylinderData = {
      center: [-0.5, 0.0, 0.0, 0.0], // vec4; w unused
      radius: 0.05,
      ymin: -0.125,
      ymax: 0.125
    };
  }
  
  async createGeometry() {
    // Create camera buffer to store the camera pose, focal, and resolution.
    this._cameraBuffer = this._device.createBuffer({
      label: "Camera " + this.getName(),
      size: this._camera._pose.byteLength +
            this._camera._focal.byteLength +
            this._camera._resolutions.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }); 
    // Write camera data.
    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._camera._pose);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength, this._camera._focal);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength + this._camera._focal.byteLength, this._camera._resolutions);
    
    // Create box buffer (existing code).
    this._boxBuffer = this._device.createBuffer({
      label: "Box " + this.getName(),
      size: this._box._pose.byteLength + this._box._scales.byteLength + this._box._top.byteLength * 6,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    let offset = 0;
    this._device.queue.writeBuffer(this._boxBuffer, offset, this._box._pose);
    offset += this._box._pose.byteLength;
    this._device.queue.writeBuffer(this._boxBuffer, offset, this._box._scales);
    offset += this._box._scales.byteLength;
    this._device.queue.writeBuffer(this._boxBuffer, offset, this._box._front);
    offset += this._box._front.byteLength;
    this._device.queue.writeBuffer(this._boxBuffer, offset, this._box._back);
    offset += this._box._back.byteLength;
    this._device.queue.writeBuffer(this._boxBuffer, offset, this._box._left);
    offset += this._box._left.byteLength;
    this._device.queue.writeBuffer(this._boxBuffer, offset, this._box._right);
    offset += this._box._right.byteLength;
    this._device.queue.writeBuffer(this._boxBuffer, offset, this._box._top);
    offset += this._box._top.byteLength;
    this._device.queue.writeBuffer(this._boxBuffer, offset, this._box._down);
    
    // --- New: Create uniform buffers for the extra shapes ---
    // Each shape is defined as 32 bytes (for alignment).
    // Cube: vec4 (16 bytes) + float (4 bytes) + vec3 padding (12 bytes)
    this._cubeBuffer = this._device.createBuffer({
      label: "Cube Buffer " + this.getName(),
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const cubeArray = new Float32Array([
      ...this._cubeData.center,  // 4 values
      this._cubeData.halfSize,
      0, 0, 0,  // padding (3 values)
      0,0,0,0
    ]);
    this._device.queue.writeBuffer(this._cubeBuffer, 0, cubeArray);
    
    // Sphere: same size (vec4 center + radius + padding)
    this._sphereBuffer = this._device.createBuffer({
      label: "Sphere Buffer " + this.getName(),
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const sphereArray = new Float32Array([
      ...this._sphereData.center,  // 4 values
      this._sphereData.radius,
      0, 0, 0 , 0,0,0,0 // padding
    ]);
    this._device.queue.writeBuffer(this._sphereBuffer, 0, sphereArray);
    
    // Cylinder: defined as vec4 center (16 bytes), radius (4 bytes), ymin (4 bytes), ymax (4 bytes), padding (4 bytes) = 32 bytes.
    this._cylinderBuffer = this._device.createBuffer({
      label: "Cylinder Buffer " + this.getName(),
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const cylinderArray = new Float32Array([
      ...this._cylinderData.center,  // 4 values
      this._cylinderData.radius,
      this._cylinderData.ymin,
      this._cylinderData.ymax,
      0  // padding
    ]);
    this._device.queue.writeBuffer(this._cylinderBuffer, 0, cylinderArray);
  }
  
  updateGeometry() {
    // update the image size of the camera
    this._camera.updateSize(this._imgWidth, this._imgHeight);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength + this._camera._focal.byteLength, this._camera._resolutions);
  }
  
  updateBoxPose() {
    this._device.queue.writeBuffer(this._boxBuffer, 0, this._box._pose);
  }
  
  updateBoxScales() {
    this._device.queue.writeBuffer(this._boxBuffer, this._box._pose.byteLength, this._box._scales);
  }
  
  updateCameraPose() {
    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._camera._pose);
  }
  
  updateCameraFocal() {
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength, this._camera._focal);
  }

  async createShaders() {
    let shaderCode = await this.loadShader("/shaders/tracebox2.wgsl");
    this._shaderModule = this._device.createShaderModule({
      label: " Shader " + this.getName(),
      code: shaderCode,
    });
    // Modify the bind group layout to include new uniform bindings (bindings 3, 4, and 5)
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Ray Trace Box Layout " + this.getName(),
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: {} }, // camera
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: {} }, // box
        { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: this._canvasFormat } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: {} }, // cube
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: {} }, // sphere
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: {} }  // cylinder
      ]
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Ray Trace Box Pipeline Layout",
      bindGroupLayouts: [ this._bindGroupLayout ],
    });
  }
  
  async createComputePipeline() {
    // Create a compute pipeline that updates the image.
    this._computePipeline = this._device.createComputePipeline({
      label: "Ray Trace Box Orthogonal Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeOrthogonalMain",
      }
    });
    // Create a compute pipeline that updates the image.
    this._computeProjectivePipeline = this._device.createComputePipeline({
      label: "Ray Trace Box Projective Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeProjectiveMain",
      }
    });
  }

  createBindGroup(outTexture) {
    // Create a bind group that now includes the extra shape buffers.
    this._bindGroup = this._device.createBindGroup({
      label: "Ray Trace Box Bind Group " + this.getName(),
      layout: this._computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this._cameraBuffer } },
        { binding: 1, resource: { buffer: this._boxBuffer } },
        { binding: 2, resource: outTexture.createView() },
        { binding: 3, resource: { buffer: this._cubeBuffer } },
        { binding: 4, resource: { buffer: this._sphereBuffer } },
        { binding: 5, resource: { buffer: this._cylinderBuffer } }
      ],
    });
    this._wgWidth = Math.ceil(outTexture.width);
    this._wgHeight = Math.ceil(outTexture.height);
  }
  
  compute(pass) {
    // Set the appropriate pipeline based on camera mode.
    if (this._camera?._isProjective) {
      pass.setPipeline(this._computeProjectivePipeline);
    } else {
      pass.setPipeline(this._computePipeline);
    }
    pass.setBindGroup(0, this._bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this._wgWidth / 16), Math.ceil(this._wgHeight / 16));
  }
}
