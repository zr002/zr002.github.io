/*!
 * Copyright ...
 * (License text omitted for brevity)
 */

import RayTracingObject from "/Quest8/lib/DSViz/RayTracingObject.js"
import UnitCube from "/Quest8/lib/DS/UnitCube.js"

export default class RayTracingBoxLightObject extends RayTracingObject {
  constructor(device, canvasFormat, camera, showTexture = true) {
    super(device, canvasFormat);
    this._box = new UnitCube();
    this._camera = camera;
    this._showTexture = showTexture;
    
    // NEW: We'll store shadingMode (0=Lambertian, 1=Phong, 2=Toon).
    // Also store some extra floats for specular power, toon levels, etc.
    // We'll push these to a GPU buffer in createGeometry().
    this._shadingMode = 0;            // default: Lambertian
    this._specularPower = 32.0;       // typical Phong exponent
    this._toonLevels = 5.0;           // how many bands for Toon shading
  }
  
  async createGeometry() {
    // Create camera buffer to store the camera pose and scale in GPU
    this._cameraBuffer = this._device.createBuffer({
      label: "Camera " + this.getName(),
      size: this._camera._pose.byteLength + this._camera._focal.byteLength + this._camera._resolutions.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }); 
    // Copy from CPU to GPU - both pose and scales
    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._camera._pose);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength, this._camera._focal);
    this._device.queue.writeBuffer(
      this._cameraBuffer, 
      this._camera._pose.byteLength + this._camera._focal.byteLength, 
      this._camera._resolutions
    );

    // Create box buffer to store the box in GPU
    this._boxBuffer = this._device.createBuffer({
      label: "Box " + this.getName(),
      size: this._box._pose.byteLength + this._box._scales.byteLength + this._box._top.byteLength * 6,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // Copy from CPU to GPU
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

    // Create light buffer to store the light in GPU
    this._lightBuffer = this._device.createBuffer({
      label: "Light " + this.getName(),
      size: 20 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }); 

    // NEW: Create shading buffer to store shadingMode, specular power, etc.
    // We'll store it in a small Float32Array or UInt32Array. We'll do 4 floats for convenience.
    // [0] = shadingMode (we can store as float or use Uint32)
    // [1] = specularPower
    // [2] = toonLevels
    // [3] = placeholder (could store something else, e.g. an ambient factor)
    this._shadingBuffer = this._device.createBuffer({
      label: "Shading " + this.getName(),
      size: 16, // 4 floats * 4 bytes each
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    // Write initial shading data
    this.updateShadingBuffer();
  }
  
  updateGeometry() {
    // update the image size of the camera
    this._camera.updateSize(this._imgWidth, this._imgHeight);
    this._device.queue.writeBuffer(
      this._cameraBuffer, 
      this._camera._pose.byteLength + this._camera._focal.byteLength, 
      this._camera._resolutions
    );
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

  updateLight(light) {
    let offset = 0;
    this._device.queue.writeBuffer(this._lightBuffer, offset, light._intensity);
    offset += light._intensity.byteLength;
    this._device.queue.writeBuffer(this._lightBuffer, offset, light._position);
    offset += light._position.byteLength;
    this._device.queue.writeBuffer(this._lightBuffer, offset, light._direction);
    offset += light._direction.byteLength;
    this._device.queue.writeBuffer(this._lightBuffer, offset, light._attenuation);
    offset += light._attenuation.byteLength;
    this._device.queue.writeBuffer(this._lightBuffer, offset, light._params);
  }

  // NEW: function to update shadingMode, specular, toon bands, etc.
  // Just call this anytime you want to change shading (e.g. pressing a key).
  updateShadingBuffer() {
    // We'll store shadingMode in [0], specular power in [1], toon levels in [2].
    // For simplicity, let's do it all as float. The "mode" is an integer, but storing
    // as float is fine if your WGSL does e.g. `let mode = u32(shading.shadingMode);`.
    const data = new Float32Array(4);
    data[0] = this._shadingMode;       // 0=Lambertian, 1=Phong, 2=Toon
    data[1] = this._specularPower;     // e.g. 32.0
    data[2] = this._toonLevels;        // e.g. 5.0
    data[3] = 0.0;                     // ambient factor, or placeholder

    this._device.queue.writeBuffer(this._shadingBuffer, 0, data);
  }

  // NEW: let you set shading mode from outside:
  setShadingMode(mode) {
    this._shadingMode = mode; 
    this.updateShadingBuffer();
  }
  // NEW: let you set specular power (for Phong):
  setSpecularPower(pow) {
    this._specularPower = pow;
    this.updateShadingBuffer();
  }
  // NEW: let you set how many bands (for Toon):
  setToonLevels(levels) {
    this._toonLevels = levels;
    this.updateShadingBuffer();
  }

  async createShaders() {
    let shaderCode = await this.loadShader("/shaders/traceboxlight.wgsl");
    this._shaderModule = this._device.createShaderModule({
      label: " Shader " + this.getName(),
      code: shaderCode,
    });
    // Create the bind group layout
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Ray Trace Box Layout " + this.getName(),
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {} // Camera uniform buffer
      }, {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {} // Box uniform buffer
      }, {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { format: this._canvasFormat } // texture
      }, {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {} // Light uniform buffer
      },
      // NEW: shading uniform
      {
        binding: 4,                     // new binding
        visibility: GPUShaderStage.COMPUTE,
        buffer: {} // shading uniform buffer
      }]
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
    this._bindGroup = this._device.createBindGroup({
      label: "Ray Trace Box Bind Group",
      layout: this._computePipeline.getBindGroupLayout(0),
      entries: [
      {
        binding: 0,
        resource: { buffer: this._cameraBuffer }
      },
      {
        binding: 1,
        resource: { buffer: this._boxBuffer }
      },
      {
        binding: 2,
        resource: outTexture.createView()
      },
      {
        binding: 3,
        resource: { buffer: this._lightBuffer }
      },
      // NEW: shading uniform at binding=4
      {
        binding: 4,
        resource: { buffer: this._shadingBuffer }
      }
      ],
    });
    this._wgWidth = Math.ceil(outTexture.width);
    this._wgHeight = Math.ceil(outTexture.height);
  }
  
  compute(pass) {
    if (this._camera?._isProjective) {
      pass.setPipeline(this._computeProjectivePipeline);
    }
    else {
      pass.setPipeline(this._computePipeline);
    }
    pass.setBindGroup(0, this._bindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(this._wgWidth / 16), 
      Math.ceil(this._wgHeight / 16)
    );
  }
}
