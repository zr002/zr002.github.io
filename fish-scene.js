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

  const createBuffer = (device, data) => {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  };

  const createShaderModule = (device, color) => device.createShaderModule({
    code: `
      @vertex
      fn vertexMain(@location(0) position: vec3f) -> @builtin(position) vec4f {
        return vec4f(position, 1.0);
      }
      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(${color}, 1.0);
      }
    `,
  });

  const createPipeline = (device, shaderModule) => device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vertexMain',
      buffers: [{
        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
        attributes: [{
          shaderLocation: 0,
          offset: 0,
          format: 'float32x3',
        }],
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragmentMain',
      targets: [{
        format: canvasFormat,
      }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  const triangleVertices = new Float32Array([
    -0.5, 0.5, 0.0,  -0.6, 0.45, 0.0,  -0.6, 0.55, 0.0,
    0.3, -0.2, 0.0,  0.5, -0.3, 0.0,  0.5, -0.1, 0.0,
    -0.2, 0.0, 0.0,  -0.5, -0.15, 0.0,  -0.5, 0.15, 0.0,
    0.4, 0.3, 0.0,  0.25, 0.25, 0.0,  0.25, 0.35, 0.0,
    -0.6, -0.4, 0.0,  -0.65, -0.42, 0.0,  -0.65, -0.38, 0.0,
    -0.3, 0.7, 0.0,  -0.4, 0.65, 0.0,  -0.4, 0.75, 0.0,
    0.2, -0.6, 0.0,  0.4, -0.7, 0.0,  0.4, -0.5, 0.0,
    -0.7, -0.1, 0.0,  -0.9, -0.2, 0.0,  -0.9, 0.0, 0.0,
  ]);

  const starVertices = new Float32Array([
    0.7, -0.3, 0.0,  0.595, -0.36, 0.0,  0.805, -0.36, 0.0,
    0.7, -0.421, 0.0,  0.595, -0.24, 0.0,  0.805, -0.24, 0.0,
  ]);

  const seaweedVertices = new Float32Array([
    -0.9, -1.0, 0.0,  -0.9, -0.85, 0.0,  -0.88, -0.85, 0.0,
    -0.7, -1.0, 0.0,  -0.7, -0.85, 0.0,  -0.68, -0.85, 0.0,
    -0.5, -1.0, 0.0,  -0.5, -0.85, 0.0,  -0.48, -0.85, 0.0,
  ]);

  const buffers = {
    triangles: createBuffer(device, triangleVertices),
    stars: createBuffer(device, starVertices),
    seaweed: createBuffer(device, seaweedVertices),
  };

  const shaders = {
    triangles: createShaderModule(device, "1.0, 1.0, 0.0"),  // Yellow (Fish)
    stars: createShaderModule(device, "1.0, 0.5, 0.0"),      // Orange (Starfish)
    seaweed: createShaderModule(device, "0.0, 1.0, 0.0"),    // Green (Seaweed)
  };

  const pipelines = {
    triangles: createPipeline(device, shaders.triangles),
    stars: createPipeline(device, shaders.stars),
    seaweed: createPipeline(device, shaders.seaweed),
  };

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.51, g: 0.83, b: 0.98, a: 1 }, // Light blue background
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });

  passEncoder.setPipeline(pipelines.triangles);
  passEncoder.setVertexBuffer(0, buffers.triangles);
  passEncoder.draw(triangleVertices.length / 3);

  passEncoder.setPipeline(pipelines.stars);
  passEncoder.setVertexBuffer(0, buffers.stars);
  passEncoder.draw(starVertices.length / 3);

  passEncoder.setPipeline(pipelines.seaweed);
  passEncoder.setVertexBuffer(0, buffers.seaweed);
  passEncoder.draw(seaweedVertices.length / 3);

  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
}

initWebGPU();
