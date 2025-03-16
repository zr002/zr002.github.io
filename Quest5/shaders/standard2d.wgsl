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

// We declare a uniform color, which we’ll pass in from the CPU side
@group(0) @binding(0)
var<uniform> u_color: vec4<f32>;

// Define a simple struct to pass data from vertex to fragment
struct VSOut {
    @builtin(position) position: vec4<f32>,  // the final clip-space position
    @location(0) color: vec4<f32>           // the color we’ll interpolate
};

@vertex
fn vertexMain(@location(0) pos: vec2f) -> VSOut {
    var out: VSOut;
    // place the vertex on screen
    out.position = vec4f(pos, 0.0, 1.0);
    // carry the uniform color to fragment stage
    out.color = u_color;
    return out;
}

@fragment
fn fragmentMain(in: VSOut) -> @location(0) vec4<f32> {
    // simply output the color from the vertex stage
    return in.color;
}
