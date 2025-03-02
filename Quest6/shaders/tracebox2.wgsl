/* 
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

// struct to store a 3D Math pose
struct Pose {
  pos: vec4f,
  angles: vec4f,
}

// this function translates a 3d point by (dx, dy, dz)
fn translate(pt: vec3f, dx: f32, dy: f32, dz: f32) -> vec3f {
  return vec3f(pt[0] + dx, pt[1] + dy, pt[2] + dz);
}

// this function rotates a 3d point along the x/y/z-axis for angle
// axis is either 0, 1, or 2 for x-axis, y-axis, or z-axis
// angle is in rad
fn rotate(pt: vec3f, axis: i32, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  switch (axis) {
    case 0: { // x-axis
      // y'=ycosθ−zsinθ, z'=ysinθ+zcosθ
      return vec3f(pt[0], pt[1] * c - pt[2] * s, pt[1] * s + pt[2] * c);
    }
    case 1: {// y-axis
      // x'=xcosθ+zsinθ, z'=−xsinθ+zcosθ
      return vec3f(pt[0] * c + pt[2] * s, pt[1], -pt[0] * s + pt[2] * c);
    }
    case 2: {// z-axis
      // x'=xcosθ−ysinθ, y'=xsinθ+ycosθ
      return vec3f(pt[0] * c - pt[1] * s, pt[0] * s + pt[1] * c, pt[2]);
    }
    default: {
      return pt;
    }
  }
}

// this function applies a pose to transform a point
fn applyPoseToPoint(pt: vec3f, pose: Pose) -> vec3f {
  var out = rotate(pt, 0, pose.angles.x);
  out = rotate(out, 1, pose.angles.y);
  out = rotate(out, 2, pose.angles.z);
  out = translate(out, pose.pos.x, pose.pos.y, pose.pos.z);
  return out;
}

// this function applies a pose to transform a direction
fn applyPoseToDir(dir: vec3f, pose: Pose) -> vec3f {
  var out = rotate(dir, 0, pose.angles.x);
  out = rotate(out, 1, pose.angles.y);
  out = rotate(out, 2, pose.angles.z);
  return out;
}

// this function applies a reverse pose to transform a point
fn applyReversePoseToPoint(pt: vec3f, pose: Pose) -> vec3f {
  var out = translate(pt, -pose.pos.x, -pose.pos.y, -pose.pos.z);
  out = rotate(out, 2, -pose.angles.z);
  out = rotate(out, 1, -pose.angles.y);
  out = rotate(out, 0, -pose.angles.x);
  return out;
}

// this function applies a reverse pose to transform a direction
fn applyReversePoseToDir(dir: vec3f, pose: Pose) -> vec3f {
  var out = rotate(dir, 2, -pose.angles.z);
  out = rotate(out, 1, -pose.angles.y);
  out = rotate(out, 0, -pose.angles.x);
  return out;
}

// define a constant
const EPSILON : f32 = 0.00000001;

// struct to store camera
struct Camera {
  pose: Pose,
  focal: vec2f,
  res: vec2f,
}

// struct to store a quad vertices
struct Quad {
  ll: vec4f, // lower left
  lr: vec4f, // lower right
  ur: vec4f, // upper right
  ul: vec4f, // upper left
}

// struct to store the box
struct Box {
  pose: Pose,     // the model pose of the box
  scale: vec4f,           // the scale of the box
  faces: array<Quad, 6>,  // six faces: front, back, left, right, top, down
}

// binding the camera pose
@group(0) @binding(0) var<uniform> cameraPose: Camera ;
// binding the box
@group(0) @binding(1) var<uniform> box: Box;
// binding the output texture to store the ray tracing results
@group(0) @binding(2) var outTexture: texture_storage_2d<rgba8unorm, write>;

// a helper function to get the hit point of a ray to a axis-aligned quad
fn quadRayHitCheck(s: vec3f, d: vec3f, q: Quad, ct: f32) -> vec2f {
  // Note, the quad is axis aligned
  // Step 1: Check if the hit point within the face
  var nt = -1.;
  if (abs(q.ll.z - q.ur.z) <= EPSILON) { // z is 0, i.e. front or back face
    let t = (q.ll.z - s.z) / d.z; // compute the current hit point to the check value
    if (t > 0) {
      let hPt = s + t * d;
      if (q.ll.x < hPt.x && hPt.x < q.ur.x && q.ll.y < hPt.y && hPt.y < q.ur.y) {
        nt = t;
      }
    }
  }
  else if (abs(q.ll.y - q.ur.y) <= EPSILON) { // y is 0, i.e. top or down face
    let t = (q.ll.y - s.y) / d.y; // compute the current hit point to the check value
    if (t > 0) {
      let hPt = s + t * d;
      if (q.ll.x < hPt.x && hPt.x < q.ur.x && q.ll.z < hPt.z && hPt.z < q.ur.z) {
        nt = t;
      }
    }
  }
  else if (abs(q.ll.x - q.ur.x) <= EPSILON) { // x is 0, i.e. left or right face
    let t = (q.ll.x - s.x) / d.x; // compute the current hit point to the check value
    if (t > 0) {
      let hPt = s + t * d;
      if (q.ll.y < hPt.y && hPt.y < q.ur.y && q.ll.z < hPt.z && hPt.z < q.ur.z) {
        nt = t;
      }
    }
  }
  
  // return the hit cases
  if (nt < 0) {
    return vec2f(ct, -1); // Case 1: the ray has already passed the face, no hit
  }
  else if (ct < 0) {
    return vec2f(nt, 1.); // Case 2: the first hit is nt, and say it hits the new face
  }
  else {
    if (nt < ct) {
      return vec2f(nt, 1.); // Case 3: the closer is nt, and say it hits the new face first
    }
    else {
      return vec2f(ct, -1.); // Case 4: the closer is ct, and say it hits the old face first
    }
  }
}

// a function to transform the direction to the model coordiantes
fn transformDir(d: vec3f) -> vec3f {
  // Step 1: transform direction from camera -> world
  var out = applyPoseToDir(d, cameraPose.pose);

  // Step 2: transform direction from world -> box's model
  out = applyReversePoseToDir(out, box.pose);

  return out;
}

fn transformPt(pt: vec3f) -> vec3f {
  // Step 1: transform point from camera -> world
  var out = applyPoseToPoint(pt, cameraPose.pose);

  // Step 2: transform point from world -> box's model
  out = applyReversePoseToPoint(out, box.pose);

  return out;
}


// a function to compute the ray box intersection
fn rayBoxIntersection(s: vec3f, d: vec3f) -> vec2f { // output is (t, idx)
  // t is the hit value, idx is the fact it hits
  // here we have six planes to check and we keep the cloest hit point
  var t = -1.;
  var idx = -1.;
  for (var i = 0; i < 6; i++) {
    let info = quadRayHitCheck(s, d, box.faces[i], t);
    if (info.y > 0) {
      t = info.x;
      idx = f32(i);
    }
  }
  return vec2f(t, idx);
}





@compute
@workgroup_size(16, 16)
fn computeOrthogonalMain(@builtin(global_invocation_id) global_id: vec3u) {
  // get the pixel coordiantes
  let uv = vec2i(global_id.xy);
  let texDim = vec2i(textureDimensions(outTexture));
  if (uv.x < texDim.x && uv.y < texDim.y) {
    // compute the pixel size
    let psize = vec2f(2, 2) / cameraPose.res.xy;
    // orthogonal camera ray sent from each pixel center at z = 0
    var spt = vec3f((f32(uv.x) + 0.5) * psize.x - 1, (f32(uv.y) + 0.5) * psize.y - 1, 0);
    var rdir = vec3f(0, 0, 1);
    // apply transformation
    spt = transformPt(spt);
    rdir = transformDir(rdir);
    // compute the intersection to the object
    var hitInfo = rayBoxIntersection(spt, rdir);
    // assign colors
    assignColor(uv, hitInfo.x, i32(hitInfo.y));
  }
}

struct Cube {
  center: vec4f,   // use xyz for center; w unused
  halfSize: f32,   // half the edge length
  _pad: vec3f,     // padding to 16-byte alignment
};

// A sphere
struct Sphere {
  center: vec4f,   // xyz = center
  radius: f32,
  _pad: vec3f,     // padding
};

// A cylinder (assumed aligned with the y-axis)
struct Cylinder {
  center: vec4f,   // center of the cylinder (x,z define horizontal, y defines vertical center)
  radius: f32,
  ymin: f32,       // lower y-bound in the cylinder’s local space
  ymax: f32,       // upper y-bound
  _pad: f32,       // padding
};

@group(0) @binding(3) var<uniform> cubeData: Cube;
@group(0) @binding(4) var<uniform> sphereData: Sphere;
@group(0) @binding(5) var<uniform> cylinderData: Cylinder;

// =======================================
// Helper Functions
// =======================================

// --- Face-based color for the box (each face gets a different color) ---
fn colorByFace(idx: i32) -> vec4f {
    switch (idx) {
        case 0: { return vec4f(232.0/255.0, 119.0/255.0, 34.0/255.0, 1.0); }
        case 1: { return vec4f(255.0/255.0, 163.0/255.0, 0.0, 1.0); }
        case 2: { return vec4f(0.0, 130.0/255.0, 186.0/255.0, 1.0); }
        case 3: { return vec4f(89.0/255.0, 203.0/255.0, 232.0/255.0, 1.0); }
        case 4: { return vec4f(217.0/255.0, 217.0/255.0, 214.0/255.0, 1.0); }
        case 5: { return vec4f(167.0/255.0, 168.0/255.0, 170.0/255.0, 1.0); }
        default: { return vec4f(0.0, 0.0, 0.0, 1.0); }
    }
}

// --- Distance-based color: maps the hit distance t to a tint from red to blue ---
fn colorByDistance(t: f32) -> vec4f {
    if (t < 0.0) {
        return vec4f(0.0, 0.0, 0.0, 1.0); // No hit: return black (this will be blended out later)
    }
    let maxT: f32 = 10.0;
    let clampedT = clamp(t, 0.0, maxT);
    let ratio = clampedT / maxT; // ratio in [0,1]
    let r = 1.0 - ratio;         // red fades out with distance
    let b = ratio;               // blue increases with distance
    return vec4f(r, 0.0, b, 1.0);
}

// --- Final color assignment function ---
// shapeID is used as follows:
//  • If shapeID is 10, 11, or 12, then the extra shapes (cube, sphere, cylinder)
//    are given fixed base colors (red, green, blue respectively).
//  • Otherwise, the outer box's face color (using face index 0-5) is used.
fn assignColor(uv: vec2i, t: f32, shapeID: i32) {
    // If no hit, set pixel to white.
    if (t < 0.0) {
        textureStore(outTexture, uv, vec4f(1.0, 1.0, 1.0, 1.0));
        return;
    }
    var baseColor: vec4f;
    if (shapeID == 10) {
        baseColor = vec4f(1.0, 0.0, 0.0, 1.0); // extra cube: red
    } else if (shapeID == 11) {
        baseColor = vec4f(0.0, 1.0, 0.0, 1.0); // sphere: green
    } else if (shapeID == 12) {
        baseColor = vec4f(0.0, 0.0, 1.0, 1.0); // cylinder: blue
    } else {
        // Otherwise, use the box's face color based on its face index.
        baseColor = colorByFace(shapeID);
    }
    // Blend the base color with a tint based on hit distance.
    let distColor = colorByDistance(t);
    let finalColor = 0.7 * baseColor + 0.3 * distColor;
    textureStore(outTexture, uv, finalColor);
}



// =======================================
// Intersection Functions
// =======================================

// ----- Cube Intersection using the slab method -----
fn axisSlabIntersect(rOriginCoord: f32, rDirCoord: f32, negExtent: f32, posExtent: f32) -> vec2f {
    if (abs(rDirCoord) < 1e-6) {
        if (rOriginCoord < negExtent || rOriginCoord > posExtent) {
            return vec2f(999999.0, -999999.0);
        }
        return vec2f(-999999.0, 999999.0);
    }
    let t0 = (negExtent - rOriginCoord) / rDirCoord;
    let t1 = (posExtent - rOriginCoord) / rDirCoord;
    if (t0 > t1) {
        return vec2f(t1, t0);
    }
    return vec2f(t0, t1);
}

fn rayCubeIntersection(s: vec3f, d: vec3f, center: vec3f, halfSize: f32) -> f32 {
    let ro = s - center;
    var tMin = -999999.0;
    var tMax =  999999.0;

    let slabX = axisSlabIntersect(ro.x, d.x, -halfSize, halfSize);
    tMin = max(tMin, slabX.x);
    tMax = min(tMax, slabX.y);

    let slabY = axisSlabIntersect(ro.y, d.y, -halfSize, halfSize);
    tMin = max(tMin, slabY.x);
    tMax = min(tMax, slabY.y);

    let slabZ = axisSlabIntersect(ro.z, d.z, -halfSize, halfSize);
    tMin = max(tMin, slabZ.x);
    tMax = min(tMax, slabZ.y);

    if (tMax < 0.0 || tMin > tMax) {
        return -1.0;
    }
    return tMin;
}

// ----- Sphere Intersection -----
fn raySphereIntersection(p: vec3f, d: vec3f, center: vec3f, radius: f32) -> f32 {
    let oc = p - center;
    let a = dot(d, d);
    let b = 2.0 * dot(oc, d);
    let c = dot(oc, oc) - radius * radius;
    let discriminant = b * b - 4.0 * a * c;
    if (discriminant < 0.0) {
        return -1.0;
    }
    let sqrtD = sqrt(discriminant);
    let t1 = (-b - sqrtD) / (2.0 * a);
    let t2 = (-b + sqrtD) / (2.0 * a);
    var tHit = -1.0;
    if (t1 > 0.0 && t2 > 0.0) {
        tHit = min(t1, t2);
    } else if (t1 > 0.0) {
        tHit = t1;
    } else if (t2 > 0.0) {
        tHit = t2;
    }
    return tHit;
}

// ----- Cylinder Intersection (finite, aligned with the y-axis) -----
fn rayCylinderIntersection(p: vec3f, d: vec3f, radius: f32, ymin: f32, ymax: f32) -> f32 {
    let a = d.x * d.x + d.z * d.z;
    if (abs(a) < 1e-6) {
        return -1.0;
    }
    let b = 2.0 * (p.x * d.x + p.z * d.z);
    let c = p.x * p.x + p.z * p.z - radius * radius;
    let disc = b * b - 4.0 * a * c;
    if (disc < 0.0) {
        return -1.0;
    }
    let sqrtDisc = sqrt(disc);
    let t1 = (-b - sqrtDisc) / (2.0 * a);
    let t2 = (-b + sqrtDisc) / (2.0 * a);
    var tHit = -1.0;
    if (t1 > 0.0) {
        let yhit = p.y + t1 * d.y;
        if (yhit >= ymin && yhit <= ymax) {
            tHit = t1;
        }
    }
    if (t2 > 0.0) {
        let yhit = p.y + t2 * d.y;
        if (yhit >= ymin && yhit <= ymax) {
            if (tHit < 0.0 || t2 < tHit) {
                tHit = t2;
            }
        }
    }
    return tHit;
}

// Utility: choose the closer (smallest positive) t value
fn pickCloser(currentT: f32, newT: f32) -> f32 {
    if (currentT < 0.0) {
        return newT;
    }
    if (newT < 0.0) {
        return currentT;
    }
    return min(currentT, newT);
}

@compute
@workgroup_size(16, 16)
fn computeProjectiveMain(@builtin(global_invocation_id) global_id: vec3u) {
  let uv = vec2i(global_id.xy);
  let texDim = vec2i(textureDimensions(outTexture));
  if (uv.x < texDim.x && uv.y < texDim.y) {
    // Compute normalized device coordinates.
    let psize = vec2f(2.0, 2.0) / cameraPose.res.xy;
    let ndcX = (f32(uv.x) + 0.5) * psize.x - 1.0;
    let ndcY = (f32(uv.y) + 0.5) * psize.y - 1.0;
    let fx = cameraPose.focal.x;
    let fy = cameraPose.focal.y;
    let pinholeX = ndcX / fx;
    let pinholeY = ndcY / fy;
    
    // For a pinhole camera: ray origin at (0,0,0) and direction towards (pinholeX, pinholeY, 1)
    var spt = vec3f(0.0, 0.0, 0.0);
    var rdir = normalize(vec3f(pinholeX, pinholeY, 1.0));
    spt = transformPt(spt);
    rdir = transformDir(rdir);
    
    // Compute box intersection
    let boxHit = rayBoxIntersection(spt, rdir);
    var bestT = boxHit.x;
    // If using box, the face index (0 to 5) becomes the shape ID.
    var shapeID = i32(boxHit.y);
    
    // Compute extra shape intersections:
    // Extra Cube intersection (assign shapeID = 10)
    let tCube = rayCubeIntersection(spt, rdir, cubeData.center.xyz, cubeData.halfSize);
    if (tCube > 0.0 && (bestT < 0.0 || tCube < bestT)) {
        bestT = tCube;
        shapeID = 10;
    }
    // Sphere intersection (assign shapeID = 11)
    let tSphere = raySphereIntersection(spt, rdir, sphereData.center.xyz, sphereData.radius);
    if (tSphere > 0.0 && (bestT < 0.0 || tSphere < bestT)) {
        bestT = tSphere;
        shapeID = 11;
    }
    // Cylinder intersection (assign shapeID = 12)
    let tCyl = rayCylinderIntersection(spt, rdir, cylinderData.radius, cylinderData.ymin, cylinderData.ymax);
    if (tCyl > 0.0 && (bestT < 0.0 || tCyl < bestT)) {
        bestT = tCyl;
        shapeID = 12;
    }
    
    // Output the color based on the intersection:
    assignColor(uv, bestT, shapeID);
  }
}



 

