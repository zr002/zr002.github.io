 // particles.wgsl

// Particle structure: 7 floats per particle.
// [pos.x, pos.y, initPos.x, initPos.y, vel.x, vel.y, life]
// For waterfall particles, life is 0.0. For firework particles, life > 0.0.
struct Particle {
  pos: vec2<f32>,
  initPos: vec2<f32>,
  vel: vec2<f32>,
  life: f32,
};

// Bindings.
@group(0) @binding(0)
var<storage, read> particlesIn: array<Particle>;

@group(0) @binding(1)
var<storage, read_write> particlesOut: array<Particle>;

@group(0) @binding(2)
var<uniform> mouse: vec3<f32>; // (mouse.x, mouse.y, mouse.active); active > 0.5 means clicked

@group(0) @binding(3)
var<uniform> windEnabled: f32;

// -------- Vertex Shader --------
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) isFire: f32,
  @location(1) ratio: f32, // For firework: ratio = life / 128.0 (1 means new, 0 means expired)
};

@vertex
fn vertexMain(@builtin(instance_index) idx: u32,
              @builtin(vertex_index) vIdx: u32) -> VertexOutput {
  let particle = particlesIn[idx];
  var size: f32;
  var ratio: f32 = 0.0;
  if (particle.life > 0.0) {
    // Firework particle: size based on a fixed value (could be adjusted if desired).
    size = 0.01;
    ratio = particle.life / 128.0; // assuming firework lifespan is 128.
  } else {
    // Waterfall particle: fixed small size.
    size = 0.005;
  }
  
  // Draw a circle with an 8-segment line-strip.
  let segments: u32 = 8u;
  let angle: f32 = 2.0 * 3.14159265 * f32(vIdx % segments) / f32(segments);
  let offset: vec2<f32> = vec2<f32>(cos(angle), sin(angle)) * size;
  
  var out: VertexOutput;
  out.pos = vec4f(particle.pos + offset, 0.0, 1.0);
  out.isFire = select(0.0, 1.0, particle.life > 0.0);
  out.ratio = ratio;
  return out;
}

@fragment
fn fragmentMain(@location(0) isFire: f32,
                @location(1) ratio: f32) -> @location(0) vec4f {
  if (isFire > 0.5) {
    // Firework: blend from bright yellow (base) to reddish transparent.
    let baseColor = vec4f(253.0/255.0, 207.0/255.0, 88.0/255.0, 1.0);
    let fadeColor = vec4f(128.0/255.0, 9.0/255.0, 9.0/255.0, 0.0);
    return mix(baseColor, fadeColor, 1.0 - ratio);
  } else {
    // Waterfall: white.
    return vec4f(1.0, 1.0, 1.0, 1.0);
  }
}



// -------- Compute Shader --------
@compute @workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let idx: u32 = global_id.x;
  if (idx >= arrayLength(&particlesIn)) { 
    return; 
  }
  
  var particle: Particle = particlesIn[idx];
  
  // If life > 0, it's a firework particle.
  if (particle.life > 0.0) {
    particle.pos = particle.pos + particle.vel;
    
    // Horizontal wrap-around:
    if (particle.pos.x > 1.0) {
      particle.pos.x = particle.pos.x - 2.0;
    } else if (particle.pos.x < -1.0) {
      particle.pos.x = particle.pos.x + 2.0;
    }
    
    // Optionally, add vertical wrap-around if desired:
    // if (particle.pos.y > 1.0) {
    //   particle.pos.y = particle.pos.y - 2.0;
    // } else if (particle.pos.y < -1.0) {
    //   particle.pos.y = particle.pos.y + 2.0;
    // }
    
    particle.life = particle.life - 1.0;
    if (particle.life <= 0.0) {
      // When the firework expires, reset it as a waterfall particle.
      let newX: f32 = -0.25 + fract(sin(f32(idx)) * 43758.5453) * 0.5;
      particle.pos = vec2<f32>(newX, 1.0);
      particle.vel = vec2<f32>(
        0.005,
        -(0.005 + fract(sin(f32(idx)*1.23) * 43758.5453) * 0.015)
      );
    }
  }
  else {
    // Waterfall update.
    particle.pos = particle.pos + particle.vel;
    let gravity: f32 = 0.0005;
    particle.vel.y = particle.vel.y - gravity;
    // Maintain constant rightward drift.
    particle.vel.x = 0.005;
    if (particle.pos.y < -1.0) {
      let newX: f32 = -0.25 + fract(sin(f32(idx)) * 43758.5453) * 0.5;
      particle.pos = vec2<f32>(newX, 1.0);
      particle.vel = vec2<f32>(0.005, -(0.005 + fract(sin(f32(idx)*1.23) * 43758.5453) * 0.015));
    }
    // Mouse interaction: if mouse is active, spawn a firework from particles near the mouse.
    if (mouse.z > 0.5) {
      let mousePos: vec2<f32> = vec2<f32>(mouse.x, mouse.y);
      let d: f32 = length(particle.pos - mousePos);
      // If the particle is within a small radius of the mouse, spawn a firework.
      if (d < 0.1) {
        particle.life = 128.0; // Set lifespan for firework effect.
        particle.vel = normalize(particle.pos - mousePos) * 0.01;
      }
    }
  }
  
  particlesOut[idx] = particle;
}