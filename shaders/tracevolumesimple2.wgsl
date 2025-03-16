// struct to store a 3D Math pose
struct Pose {
  pos: vec4f,
  angles: vec4f,
}

fn translate(pt: vec3f, dx: f32, dy: f32, dz: f32) -> vec3f {
  return vec3f(pt[0] + dx, pt[1] + dy, pt[2] + dz);
}

fn rotate(pt: vec3f, axis: i32, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  switch (axis) {
    case 0: { return vec3f(pt[0], pt[1] * c - pt[2] * s, pt[1] * s + pt[2] * c); }
    case 1: { return vec3f(pt[0] * c + pt[2] * s, pt[1], -pt[0] * s + pt[2] * c); }
    case 2: { return vec3f(pt[0] * c - pt[1] * s, pt[0] * s + pt[1] * c, pt[2]); }
    default: { return pt; }
  }
}

fn applyPoseToPoint(pt: vec3f, pose: Pose) -> vec3f {
  var out = rotate(pt, 0, pose.angles.x);
  out = rotate(out, 1, pose.angles.y);
  out = rotate(out, 2, pose.angles.z);
  out = translate(out, pose.pos.x, pose.pos.y, pose.pos.z);
  return out;
}

fn applyPoseToDir(dir: vec3f, pose: Pose) -> vec3f {
  var out = rotate(dir, 0, pose.angles.x);
  out = rotate(out, 1, pose.angles.y);
  out = rotate(out, 2, pose.angles.z);
  return out;
}

fn applyReversePoseToPoint(pt: vec3f, pose: Pose) -> vec3f {
  var out = translate(pt, -pose.pos.x, -pose.pos.y, -pose.pos.z);
  out = rotate(out, 2, -pose.angles.z);
  out = rotate(out, 1, -pose.angles.y);
  out = rotate(out, 0, -pose.angles.x);
  return out;
}

fn applyReversePoseToDir(dir: vec3f, pose: Pose) -> vec3f {
  var out = rotate(dir, 2, -pose.angles.z);
  out = rotate(out, 1, -pose.angles.y);
  out = rotate(out, 0, -pose.angles.x);
  return out;
}

struct VolInfo {
  dims: vec4f,
  sizes: vec4f,
}

const EPSILON : f32 = 0.00000001;

struct Camera {
  pose: Pose,
  focal: vec2f,
  res: vec2f,
}

@group(0) @binding(0) var<uniform> cameraPose: Camera;
@group(0) @binding(1) var<uniform> volInfo: VolInfo;
@group(0) @binding(2) var<storage> volData: array<f32>;
@group(0) @binding(3) var outTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<uniform> tfType: u32;

fn transformDir(d: vec3f) -> vec3f {
  var out = applyPoseToDir(d, cameraPose.pose);
  return out;
}

fn transformPt(pt: vec3f) -> vec3f {
  var out = applyPoseToPoint(pt, cameraPose.pose);
  return out;
}

fn assignColor(uv: vec2i) {
  var color: vec4f;
  color = vec4f(0.f/255, 56.f/255, 101.f/255, 1.);
  textureStore(outTexture, uv, color);
}

fn compareVolumeHitValues(curValue: vec2f, t: f32) -> vec2f {
  var result = curValue;
  if (curValue.x < 0.0) {
    result.x = t;
  } else {
    if (t < curValue.x) {
      result.y = curValue.x;
      result.x = t;
    } else {
      if (curValue.y < 0.0) {
        result.y = t;
      } else if (t < curValue.y) {
        result.y = t;
      }
    }
  }
  return result;
}

fn getVolumeHitValues(checkval: f32, halfsize: vec2f, pval: f32, dval: f32, p: vec2f, d: vec2f, curT: vec2f) -> vec2f {
  var cur = curT;
  if (abs(dval) > EPSILON) {
    let t = (checkval - pval) / dval;
    if (t > 0.0) {
      let hPt = p + t * d;
      if (-halfsize.x < hPt.x && hPt.x < halfsize.x && -halfsize.y < hPt.y && hPt.y < halfsize.y) {
        cur = compareVolumeHitValues(cur, t);
      }
    }
  }
  return cur;
}

fn rayVolumeIntersection(p: vec3f, d: vec3f) -> vec2f {
  var hitValues = vec2f(-1.0, -1.0);
  let halfsize = volInfo.dims * volInfo.sizes * 0.5 / max(max(volInfo.dims.x, volInfo.dims.y), volInfo.dims.z);
  hitValues = getVolumeHitValues(halfsize.z, halfsize.xy, p.z, d.z, p.xy, d.xy, hitValues);
  hitValues = getVolumeHitValues(-halfsize.z, halfsize.xy, p.z, d.z, p.xy, d.xy, hitValues);
  hitValues = getVolumeHitValues(-halfsize.x, halfsize.yz, p.x, d.x, p.yz, d.yz, hitValues);
  hitValues = getVolumeHitValues(halfsize.x, halfsize.yz, p.x, d.x, p.yz, d.yz, hitValues);
  hitValues = getVolumeHitValues(halfsize.y, halfsize.xz, p.y, d.y, p.xz, d.xz, hitValues);
  hitValues = getVolumeHitValues(-halfsize.y, halfsize.xz, p.y, d.y, p.xz, d.xz, hitValues);
  return hitValues;
}

fn getNextHitValue(startT: f32, curT: f32, checkval: f32, minCorner: vec2f, maxCorner: vec2f, pval: f32, dval: f32, p: vec2f, d: vec2f) -> f32 {
  var cur = curT;
  if (abs(dval) > EPSILON) {
    let t = (checkval - pval) / dval;
    let hPt = p + t * d;
    if (minCorner.x < hPt.x && hPt.x < maxCorner.x && minCorner.y < hPt.y && hPt.y < maxCorner.y) {
      if (t > startT && cur < t) {
        cur = t;
      }
    }
  }
  return cur;
}

fn tfCase0(intensity: f32) -> vec4f {
  return vec4f(intensity, intensity, intensity, 1.0);
}

fn tfCase1(intensity: f32) -> vec4f {
  return vec4f(1.0, 0.0, 0.0, 1.0);
}

fn tfCase2(intensity: f32) -> vec4f {
  return vec4f(0.0, 1.0, 0.0, 1.0);
}

fn tfCase3(intensity: f32) -> vec4f {
  return vec4f(0.0, 0.0, 1.0, 1.0);
}

fn applyTransferFunction(intensity: f32) -> vec4f {
  if (tfType == 0u) {
    return tfCase0(intensity);
  } else if (tfType == 1u) {
    return tfCase1(intensity);
  } else if (tfType == 2u) {
    return tfCase2(intensity);
  } else if (tfType == 3u) {
    return tfCase3(intensity);
  } else {
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }
}



fn traceScene(uv: vec2i, p: vec3f, d: vec3f) {
  var hits = rayVolumeIntersection(p, d);
  if (hits.y < 0.0 && hits.x > 0.0) {
    hits.y = hits.x;
    hits.x = 0.0;
  }
  var color = vec4f(0.0, 0.22, 0.4, 1.0);
  if (hits.x >= 0.0) {
    let stepSize = 0.1;
    var maxVal = 0.0;
    let halfsize = volInfo.dims.xyz * volInfo.sizes.xyz * 0.5 
                   / max(max(volInfo.dims.x, volInfo.dims.y), volInfo.dims.z);
    var tCurrent = hits.x;
    while (tCurrent < hits.y) {
      let samplePos = p + d * tCurrent;
      let posLocal = samplePos + halfsize;
      let dimSpan = halfsize * 2.0;
      let xFrac = posLocal.x / dimSpan.x;
      let yFrac = posLocal.y / dimSpan.y;
      let zFrac = posLocal.z / dimSpan.z;
      let xIdx = i32(xFrac * volInfo.dims.x);
      let yIdx = i32(yFrac * volInfo.dims.y);
      let zIdx = i32(zFrac * volInfo.dims.z);
      if (xIdx >= 0 && xIdx < i32(volInfo.dims.x) &&
          yIdx >= 0 && yIdx < i32(volInfo.dims.y) &&
          zIdx >= 0 && zIdx < i32(volInfo.dims.z)) {
        let idx = zIdx * (i32(volInfo.dims.x) * i32(volInfo.dims.y))
                  + yIdx * i32(volInfo.dims.x)
                  + xIdx;
        let voxelVal = volData[idx];
        if (voxelVal > maxVal) {
          maxVal = voxelVal;
        }
      }
      tCurrent = tCurrent + stepSize;
    }
    let intensity = maxVal / 255.0;
    color = applyTransferFunction(intensity);
  }
  textureStore(outTexture, uv, color);
}

@compute
@workgroup_size(16, 16)
fn computeOrthogonalMain(@builtin(global_invocation_id) global_id: vec3u) {
  let uv = vec2i(global_id.xy);
  let texDim = vec2i(textureDimensions(outTexture));
  if (uv.x < texDim.x && uv.y < texDim.y) {
    let psize = vec2f(2, 2) / cameraPose.res.xy;
    var spt = vec3f((f32(uv.x) + 0.5) * psize.x - 1, (f32(uv.y) + 0.5) * psize.y - 1, 0);
    var rdir = vec3f(0, 0, 1);
    spt = transformPt(spt);
    rdir = transformDir(rdir);
    traceScene(uv, spt, rdir);
  }
}

@compute
@workgroup_size(16, 16)
fn computeProjectiveMain(@builtin(global_invocation_id) global_id: vec3u) {
  let uv = vec2i(global_id.xy);
  let texDim = vec2i(textureDimensions(outTexture));
  if (uv.x < texDim.x && uv.y < texDim.y) {
    let ndcX = (f32(uv.x) + 0.5) / f32(texDim.x) * 2.0 - 1.0;
    let ndcY = (f32(uv.y) + 0.5) / f32(texDim.y) * 2.0 - 1.0;
    let fx = cameraPose.focal.x;
    var spt = vec3f(0.0, 0.0, 0.0);
    var rdir = normalize(vec3f(ndcX, ndcY, -fx));
    spt = transformPt(spt);
    rdir = transformDir(rdir);
    traceScene(uv, spt, rdir);
  }
}
