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

  const triangleVertices = new Float32Array([
    -0.5, 0.5, 0.0,
    -0.6, 0.45, 0.0,
    -0.6, 0.55, 0.0,

    0.3, -0.2, 0.0,
    0.5, -0.3, 0.0,
    0.5, -0.1, 0.0,

    -0.2, 0.0, 0.0,
    -0.5, -0.15, 0.0,
    -0.5, 0.15, 0.0,

    0.4, 0.3, 0.0,
    0.25, 0.25, 0.0,
    0.25, 0.35, 0.0,

    -0.6, -0.4, 0.0,
    -0.65, -0.42, 0.0,
    -0.65, -0.38, 0.0,

    -0.3, 0.7, 0.0,
    -0.4, 0.65, 0.0,
    -0.4, 0.75, 0.0,

    0.2, -0.6, 0.0,
    0.4, -0.7, 0.0,
    0.4, -0.5, 0.0,

    -0.7, -0.1, 0.0,
    -0.9, -0.2, 0.0,
    -0.9, 0.0, 0.0,
  ]);

  const tailVertices = new Float32Array([
    -0.6, 0.5, 0.0,
    -0.65, 0.46, 0.0,
    -0.65, 0.54, 0.0,

    0.5, -0.2, 0.0,
    0.55, -0.25, 0.0,
    0.55, -0.15, 0.0,

    -0.5, 0.0, 0.0,
    -0.55, -0.05, 0.0,
    -0.55, 0.05, 0.0,

    0.25, 0.3, 0.0,
    0.2, 0.26, 0.0,
    0.2, 0.34, 0.0,

    -0.65, -0.4, 0.0,
    -0.68, -0.43, 0.0,
    -0.68, -0.37, 0.0,

    -0.4, 0.7, 0.0,
    -0.45, 0.66, 0.0,
    -0.45, 0.74, 0.0,

    0.4, -0.6, 0.0,
    0.45, -0.65, 0.0,
    0.45, -0.55, 0.0,

    -0.9, -0.1, 0.0,
    -0.95, -0.15, 0.0,
    -0.95, -0.05, 0.0,
  ]);
  const starVertices = new Float32Array([
    0.7 + 0.0 * 0.7, -0.3 + 0.121, 0.0,    
    0.7 - 0.105, -0.3 - 0.06, 0.0,       
    0.7 + 0.105, -0.3 - 0.06, 0.0,      
  
    0.7 + 0.0 * 0.7, -0.3 - 0.221, 0.0,   
    0.7 - 0.105, -0.3 + 0.06, 0.0,       
    0.7 + 0.105, -0.3 + 0.06, 0.0,        
  ]);


  const seaweedVertices = new Float32Array([
    -0.9, -1.0, 0.0,  
    -0.9, -0.85, 0.0, 
    -0.88, -0.85, 0.0, 
    -0.9, -1.0, 0.0,  
    -0.88, -0.85, 0.0, 
    -0.88, -1.0, 0.0, 
  
    -0.7, -1.0, 0.0,  
    -0.7, -0.85, 0.0, 
    -0.68, -0.85, 0.0, 
    -0.7, -1.0, 0.0,  
    -0.68, -0.85, 0.0, 
    -0.68, -1.0, 0.0,  
  
    -0.5, -1.0, 0.0,  
    -0.5, -0.85, 0.0, 
    -0.48, -0.85, 0.0, 
    -0.5, -1.0, 0.0,  
    -0.48, -0.85, 0.0, 
    -0.48, -1.0, 0.0,  

    -0.3, -1.0, 0.0,  
    -0.3, -0.85, 0.0, 
    -0.28, -0.85, 0.0, 
    -0.3, -1.0, 0.0,  
    -0.28, -0.85, 0.0, 
    -0.28, -1.0, 0.0, 
  
    -0.1, -1.0, 0.0,  
    -0.1, -0.95, 0.0, 
    -0.08, -0.95, 0.0, 
    -0.1, -1.0, 0.0, 
    -0.08, -0.95, 0.0, 
    -0.08, -1.0, 0.0, 
  ]);
  




  const rectangleVertices = new Float32Array([
    -0.7, 0.8, 0.0,
    -0.7, 0.75, 0.0,
    -0.5, 0.75, 0.0,
    -0.7, 0.8, 0.0,
    -0.5, 0.75, 0.0,
    -0.5, 0.8, 0.0,

    0.1, 0.5, 0.0,
    0.1, 0.45, 0.0,
    0.3, 0.45, 0.0,
    0.1, 0.5, 0.0,
    0.3, 0.45, 0.0,
    0.3, 0.5, 0.0,

    -0.4, -0.5, 0.0,
    -0.4, -0.55, 0.0,
    -0.2, -0.55, 0.0,
    -0.4, -0.5, 0.0,
    -0.2, -0.55, 0.0,
    -0.2, -0.5, 0.0,

    -0.2, -0.2, 0.0,
    -0.2, -0.25, 0.0,
    0.0, -0.25, 0.0,
    -0.2, -0.2, 0.0,
    0.0, -0.25, 0.0,
    0.0, -0.2, 0.0,
  ]);

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

  const rectangleBuffer = device.createBuffer({
    size: rectangleVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(rectangleBuffer, 0, rectangleVertices);

  const starBuffer = device.createBuffer({
    size: starVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(starBuffer, 0, starVertices);

  const triangleShaderModule = device.createShaderModule({
    code: `
      @vertex
      fn vertexMain(@location(0) position: vec3f) -> @builtin(position) vec4f {
        return vec4f(position, 1.0);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(1.0, 1.0, 0.0, 1.0); // Yellow color for triangles
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
        return vec4f(1.0, 0.5, 0.0, 1.0); // Orange color for stars
      }
    `,
  });

  const rectangleShaderModule = device.createShaderModule({
    code: `
      @vertex
      fn vertexMain(@location(0) position: vec3f) -> @builtin(position) vec4f {
        return vec4f(position, 1.0);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(0.0, 0.0, 0.5, 1.0); // Dark blue color for rectangles
      }
    `,
  });

  const trianglePipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: triangleShaderModule,
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
      module: triangleShaderModule,
      entryPoint: 'fragmentMain',
      targets: [{
        format: canvasFormat,
      }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  const rectanglePipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: rectangleShaderModule,
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
      module: rectangleShaderModule,
      entryPoint: 'fragmentMain',
      targets: [{
        format: canvasFormat,
      }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  const starPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: starShaderModule,
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
      module: starShaderModule,
      entryPoint: 'fragmentMain',
      targets: [{
        format: canvasFormat,
      }],
    },
    primitive: {
      topology: 'triangle-strip',
    },
  });


  const seaweedBuffer = device.createBuffer({
    size: seaweedVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(seaweedBuffer, 0, seaweedVertices);

  const seaweedShaderModule = device.createShaderModule({
    code: `
      @vertex
      fn vertexMain(@location(0) position: vec3f) -> @builtin(position) vec4f {
        return vec4f(position, 1.0);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(0.0, 1.0, 0.0, 1.0); // Green color for seaweed
      }
    `,
  });

  const seaweedPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: seaweedShaderModule,
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
      module: seaweedShaderModule,
      entryPoint: 'fragmentMain',
      targets: [{
        format: canvasFormat,
      }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
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

  passEncoder.setVertexBuffer(0, tailBuffer);
  passEncoder.draw(tailVertices.length / 3);

  passEncoder.setPipeline(rectanglePipeline);
  passEncoder.setVertexBuffer(0, rectangleBuffer);
  passEncoder.draw(rectangleVertices.length / 3);

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
