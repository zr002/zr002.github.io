async function initWebGPU() {
  const canvas = document.getElementById('webgpu-canvas');
  const context = canvas.getContext('webgpu');

  if (!navigator.gpu) {
    alert('WebGPU is not supported in this browser.');
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device: device,
    format: canvasFormat,
  });

  // Vertex Data
  const triangleVertices = new Float32Array([
    -0.5, 0.5, 0.0,  -0.6, 0.45, 0.0,  -0.6, 0.55, 0.0,
     0.3, -0.2, 0.0,  0.5, -0.3, 0.0,  0.5, -0.1, 0.0,
    -0.2, 0.0, 0.0,  -0.5, -0.15, 0.0, -0.5, 0.15, 0.0,
     0.4, 0.3, 0.0,   0.25, 0.25, 0.0,  0.25, 0.35, 0.0
  ]);

  const tailVertices = new Float32Array([
    -0.6, 0.5, 0.0,  -0.65, 0.46, 0.0,  -0.65, 0.54, 0.0,
     0.5, -0.2, 0.0,   0.55, -0.25, 0.0,  0.55, -0.15, 0.0
  ]);

  const starVertices = new Float32Array([
    0.7 + 0.0 * 0.7, -0.3 + 0.121, 0.0,    
    0.7 - 0.105, -0.3 - 0.06, 0.0,       
    0.7 + 0.105, -0.3 - 0.06, 0.0,      
    0.7 + 0.0 * 0.7, -0.3 - 0.221, 0.0,   
    0.7 - 0.105, -0.3 + 0.06, 0.0,       
    0.7 + 0.105, -0.3 + 0.06, 0.0
  ]);

  const seaweedVertices = new Float32Array([
    -0.9, -1.0, 0.0, -0.9, -0.85, 0.0, -0.88, -0.85, 0.0,
    -0.9, -1.0, 0.0, -0.88, -0.85, 0.0, -0.88, -1.0, 0.0
  ]);

  // Buffers
  const triangleBuffer = device.createBuffer({
    size: triangleVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(triangleBuffer, 0, triangleVertices);

  const tailBuffer = device.createBuffer({
    size: tailVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(tailBuffer, 0, tailVertices);

  const starBuffer = device.createBuffer({
    size: starVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(starBuffer, 0, starVertices);

  const seaweedBuffer = device.createBuffer({
    size: seaweedVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(seaweedBuffer, 0, seaweedVertices);

  // Shader Modules
  const triangleShaderModule = device.createShaderModule({
    code: `
      @vertex
      fn vertexMain(@location(0) position: vec3f) -> @builtin(position) vec4f {
        return vec4f(position, 1.0);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(1.0, 1.0, 0.0, 1.0); // Yellow
      }
    `,
  });

  const starShaderModule = device.createShaderModule({
    code: `
      @vertex
      fn vertexMain(@location(0) position: vec3f) -> @builtin(position) vec4f {
        return vec4f(position, 1.0);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(1.0, 0.5, 0.0, 1.0); // Orange for stars
      }
    `,
  });

  const seaweedShaderModule = device.createShaderModule({
    code: `
      @vertex
      fn vertexMain(@location(0) position: vec3f) -> @builtin(position) vec4f {
        return vec4f(position, 1.0);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(0.0, 1.0, 0.0, 1.0); // Green for seaweed
      }
    `,
  });

  // Pipelines
  const trianglePipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: triangleShaderModule,
      entryPoint: 'vertexMain',
      buffers: [{
        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
      }],
    },
    fragment: {
      module: triangleShaderModule,
      entryPoint: 'fragmentMain',
      targets: [{ format: canvasFormat }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const starPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: starShaderModule,
      entryPoint: 'vertexMain',
      buffers: [{
        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
      }],
    },
    fragment: {
      module: starShaderModule,
      entryPoint: 'fragmentMain',
      targets: [{ format: canvasFormat }],
    },
    primitive: { topology: 'triangle-strip' },
  });

  const seaweedPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: seaweedShaderModule,
      entryPoint: 'vertexMain',
      buffers: [{
        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
      }],
    },
    fragment: {
      module: seaweedShaderModule,
      entryPoint: 'fragmentMain',
      targets: [{ format: canvasFormat }],
    },
    primitive: { topology: 'triangle-list' },
  });

  // Render Pass
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.51, g: 0.83, b: 0.98, a: 1 }, 
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });

  passEncoder.setPipeline(trianglePipeline);
  passEncoder.setVertexBuffer(0, triangleBuffer);
  passEncoder.draw(triangleVertices.length / 3);

  passEncoder.setPipeline(starPipeline);
  passEncoder.setVertexBuffer(0, starBuffer);
  passEncoder.draw(starVertices.length / 3);

  passEncoder.setPipeline(seaweedPipeline);
  passEncoder.setVertexBuffer(0, seaweedBuffer);
  passEncoder.draw(seaweedVertices.length / 3);

  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
}

initWebGPU();
