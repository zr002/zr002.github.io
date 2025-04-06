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
 
import PlyIO from "/lib/IO/PlyIO.js"

export default class TriangleMesh {
  constructor(filename) {
    this._filename = filename;
  }
  
  centerOfMass() {
    let C = [0.0, 0.0, 0.0];
    for (let i = 0; i < this._numV; ++i) {
      for (let j = 0; j < 3; ++j) {
        C[j] += this._vertices[i][j];
      }
    }
    for (let i = 0; i < 3; ++i) {
      C[i] /= this._numV;
    }
    return C;
  }
  
  surfaceArea() {
    // Heron’s formula
    const l = (a, b) => Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2) + Math.pow(b[2] - a[2], 2));
    const area = (e0, e1, e2, s) => Math.sqrt(s * (s - e0) * (s - e1) * (s - e2));
    let A = 0;
    this._faceArea = new Array(this._numT);
    for (let i = 0; i < this._numT; ++i) {
      const v0 = this._vertices[this._triangles[i][0]];
      const v1 = this._vertices[this._triangles[i][1]];
      const v2 = this._vertices[this._triangles[i][2]];
      const e01 = l(v0, v1);
      const e12 = l(v1, v2);
      const e20 = l(v2, v0);
      const s = (e01 + e12 + e20) / 2;
      this._faceArea[i] = area(e01, e12, e20, s);
      A += this._faceArea[i];
    }
    return A;
  }
  
  normalizeMesh() {
    // Compute the center
    this._center = this.centerOfMass();
    // center it at (0, 0, 0)
    for (let i = 0; i < this._numV; ++i) {
      for (let j = 0; j < 3; ++j) {
        this._vertices[i][j] -= this._center[j];
      }
    }
    // Compute the surface area
    this._area = this.surfaceArea();
    // normalize the surface area to a target area
    const targetArea = 1;
    this._scaleFactor = Math.sqrt(1 / this._area * targetArea);
    for (let i = 0; i < this._numV; ++i) {
      for (let j = 0; j < 3; ++j) {
        this._vertices[i][j] *= this._scaleFactor;
      }
    }
    if (Math.abs(this.surfaceArea() - targetArea) > 0.0001) { // Note: this will recompute the face areas
      console.log("Something is wrong! The surface area is not as expected!");
    }
  }
  
  computeNormal() {
    this._faceNormal = new Array(this._numT);
    this._normal = Array.from({length: this._numV}, (_) => new Array(3).fill(0));
    
    const normal = (p0, p1, p2) => {
      // Compute edge vectors
      let v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      let v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      // compute cross product
      let normal = [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0]
      ];
      // normalize the vector
      let length = Math.sqrt(normal[0]**2 + normal[1]**2 + normal[2]**2);
      normal = normal.map(n => n / length);
      return normal;
    };
    
    for (let i = 0; i < this._numT; ++i) {
      if (this._faceArea[i] > 0) {
        this._faceNormal[i] = normal(
          this._vertices[this._triangles[i][0]], 
          this._vertices[this._triangles[i][1]], 
          this._vertices[this._triangles[i][2]]
        );
        for (let j = 0; j < 3; ++j) {
          for (let k = 0; k < 3; ++k) {
            this._normal[this._triangles[i][j]][k] += this._faceNormal[i][k] * this._faceArea[i] / 3;
          }
        }
      }
      else { // degenerated triangle
        this._faceNormal[i] = new Array(3);
      }
    }
  }
  
  appendNormalToVertices() {
    this._vProp.push('normal x', 'normal y', 'normal z');
    for (let i = 0; i < this._numV; ++i) {
      let length = Math.sqrt(this._normal[i][0]**2 + this._normal[i][1]**2 + this._normal[i][2]**2);
      this._normal[i] = this._normal[i].map(n => n / length);
      this._vertices[i].push(this._normal[i][0], this._normal[i][1], this._normal[i][2]);
    }
  }
  
  // ===== NEW CODE FOR LAPLACIAN INTERPOLATION =====
  
  // Method to build an adjacency list (neighbors) for each vertex
  buildAdjacency() {
    // Initialize an empty neighbor list (using a Set to avoid duplicates)
    this._neighbors = Array.from({ length: this._numV }, () => new Set());
    
    // Loop over each triangle and add neighbor relationships
    for (let i = 0; i < this._numT; i++) {
      const tri = this._triangles[i];
      let [a, b, c] = tri;
      this._neighbors[a].add(b); this._neighbors[a].add(c);
      this._neighbors[b].add(a); this._neighbors[b].add(c);
      this._neighbors[c].add(a); this._neighbors[c].add(b);
    }
    
    // Convert each neighbor set into an array
    for (let i = 0; i < this._neighbors.length; i++) {
      this._neighbors[i] = Array.from(this._neighbors[i]);
    }
  }
  
  // Method to compute the uniform Laplacian for each vertex
  computeUniformLaplacian() {
    this._laplacian = new Array(this._numV);
    for (let i = 0; i < this._numV; i++) {
      const neighbors = this._neighbors[i];
      let sum = [0, 0, 0];
      // Sum the positions of all neighbor vertices
      for (let j = 0; j < neighbors.length; j++) {
        const idx = neighbors[j];
        const neighborPos = this._vertices[idx];
        sum[0] += neighborPos[0];
        sum[1] += neighborPos[1];
        sum[2] += neighborPos[2];
      }
      // Calculate the average neighbor position
      const count = neighbors.length;
      const avg = [sum[0] / count, sum[1] / count, sum[2] / count];
      // Laplacian: current vertex position minus the average of its neighbors
      const v = this._vertices[i];
      this._laplacian[i] = [v[0] - avg[0], v[1] - avg[1], v[2] - avg[2]];
    }
  }
  // ===== END NEW CODE =====
  
  async init() {
    // Read vertices from ply files
    let [vertices, triangles, vProp] = await PlyIO.read(this._filename);
    this._numV = vertices.length;
    this._numT = triangles.length;
    this._vProp = vProp;
    this._vertices = vertices;
    this._triangles = triangles;
    
    // Normalize the mesh
    this.normalizeMesh();
    
    // Compute mesh normals if only vertex positions are provided
    if (this._vProp.length == 3) { // contains vertices only
      this.computeNormal();
      this.appendNormalToVertices();
    }
    
    // ===== NEW INITIALIZATION CODE FOR LAPLACIAN =====
    // Build adjacency list (neighbors)
    this.buildAdjacency();
    // Compute the uniform Laplacian for each vertex
    this.computeUniformLaplacian();
    // ===== END NEW INITIALIZATION CODE =====
  }
}
