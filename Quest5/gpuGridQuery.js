// gpuGridQuery.js
// This module implements a GPU-based 2D grid collision query.
// It assumes you have grid data as a Uint32Array (with 1 for INTERIOR, 0 for EXTERIOR)
// and that you have grid parameters (grid size, bounding box, etc.).

// WGSL compute shader code.
// The shader reads grid parameters from a uniform, computes which cell the query point falls into,
// and then reads that cell's value from the gridData buffer. It writes the result (1 for interior, 0 otherwise)
// to a single-element storage buffer.
const gpuGridShaderCode = `
struct GridParams {
  gridSize: u32,
  minX: f32,
  minY: f32,
  cellWidth: f32,
  cellHeight: f32,
  queryX: f32,
  queryY: f32,
};

@group(0) @binding(0) var<storage, read> gridData: array<u32>;
@group(0) @binding(1) var<storage, read_write> result: array<u32>;
@group(0) @binding(2) var<uniform> params: GridParams;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
  // Compute column and row indices for the query point.
  let col = u32(floor((params.queryX - params.minX) / params.cellWidth));
  let row = u32(floor((params.queryY - params.minY) / params.cellHeight));
  let index = row * params.gridSize + col;
  // Ensure we don't access out-of-bound.
  if (index < arrayLength(&gridData)) {
    if (gridData[index] == 1u) {
      result[0] = 1u;
    } else {
      result[0] = 0u;
    }
  }
}
`;

// gpuGridQuery function:
// device: GPUDevice
// gridDataBuffer: GPUBuffer containing grid cell type data (as Uint32 values)
// params: an object with the grid parameters:
//         { gridSize, minX, minY, cellWidth, cellHeight, queryX, queryY }
async function gpuGridQuery(device, gridDataBuffer, params) {
  // Create a uniform buffer for GridParams.
  // We pack gridSize as a float (it will be interpreted as u32 in the shader).
  const gridParamsArray = new Float32Array([
    params.gridSize, 
    params.minX, 
    params.minY, 
    params.cellWidth, 
    params.cellHeight, 
    params.queryX, 
    params.queryY
  ]);
  const gridParamsBuffer = device.createBuffer({
    size: gridParamsArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(gridParamsBuffer, 0, gridParamsArray.buffer);

  // Create a result buffer to store a single u32.
  const resultBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  // Create the shader module.
  const shaderModule = device.createShaderModule({
    code: gpuGridShaderCode,
  });

  // Create the compute pipeline.
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: shaderModule,
      entryPoint: "main",
    },
  });

  // Create a bind group with the grid data buffer, result buffer, and uniform buffer.
  const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: gridDataBuffer } },
      { binding: 1, resource: { buffer: resultBuffer } },
      { binding: 2, resource: { buffer: gridParamsBuffer } },
    ],
  });

  // Create a command encoder and dispatch the compute shader.
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(computePipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(1);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Create a temporary readback buffer.
  const readBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const copyEncoder = device.createCommandEncoder();
  copyEncoder.copyBufferToBuffer(resultBuffer, 0, readBuffer, 0, 4);
  device.queue.submit([copyEncoder.finish()]);

  // Wait for the readBuffer to be mapped.
  await readBuffer.mapAsync(GPUMapMode.READ);
  const arrayBuffer = readBuffer.getMappedRange();
  const resultArray = new Uint32Array(arrayBuffer);
  const collisionFlag = resultArray[0] === 1 ? true : false;
  readBuffer.unmap();
  return collisionFlag;
}

export { gpuGridQuery };
