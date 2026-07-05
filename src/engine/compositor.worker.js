/**
 * R.OMNIFLUX COMPOSITOR WORKER
 * Handles GPU-accelerated rendering on a dedicated thread.
 */

let gl;
let canvas;
let program;
let textures = {}; // Store textures for different sources
let layers = [];   // Order of rendering

self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            init(payload.canvas);
            break;
        case 'UPDATE_LAYERS':
            layers = payload.layers;
            break;
        case 'RENDER_FRAME':
            render();
            break;
        case 'ADD_SOURCE':
            // Logic to handle new video frames/textures
            updateTexture(payload.id, payload.bitmap);
            break;
    }
};

function init(offscreenCanvas) {
    canvas = offscreenCanvas;
    gl = canvas.getContext('webgl2', { 
        antialias: false, 
        alpha: false, 
        preserveDrawingBuffer: true 
    });

    if (!gl) {
        console.error("WebGL2 not supported in worker");
        return;
    }

    // Initialize Shaders (Simple Passthrough for now)
    const vsSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0, 1);
            v_texCoord = a_texCoord;
        }
    `;

    const fsSource = `
        precision highp float;
        uniform sampler2D u_texA;
        uniform sampler2D u_texB;
        uniform sampler2D u_overlay;
        uniform float u_mix;
        
        // Chroma Key Params
        uniform bool u_chromaEnable;
        uniform vec3 u_keyColor;
        uniform float u_threshold;
        uniform float u_slope;

        varying vec2 v_texCoord;

        vec4 processChroma(vec4 color) {
            if (!u_chromaEnable) return color;
            float d = distance(color.rgb, u_keyColor);
            float alpha = smoothstep(u_threshold, u_threshold + u_slope, d);
            return vec4(color.rgb, color.a * alpha);
        }

        void main() {
            vec4 colorA = processChroma(texture2D(u_texA, v_texCoord));
            vec4 colorB = texture2D(u_texB, v_texCoord);
            
            // 1. Blend Source A and B
            vec4 baseColor = mix(colorA, colorB, u_mix);
            
            // 2. Layer Overlay on top
            vec4 overlayColor = texture2D(u_overlay, v_texCoord);
            gl_FragColor = mix(baseColor, overlayColor, overlayColor.a);
        }
    `;

    program = createProgram(gl, vsSource, fsSource);
    gl.useProgram(program);

    // Setup buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,
        -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 1,  1, 1,  0, 0,
        0, 0,  1, 1,  1, 0,
    ]), gl.STATIC_DRAW);

    // Start Render Loop
    requestAnimationFrame(tick);
}

function tick(now) {
    render();
    requestAnimationFrame(tick);
}

function updateTexture(id, bitmap) {
    if (!textures[id]) {
        textures[id] = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, textures[id]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    bitmap.close(); // Memory management is crucial
}

let mixAmount = 0;
let transitionTarget = 0;
let texA_id = null;
let texB_id = null;

let chromaSettings = { enabled: false, color: [0, 1, 0], threshold: 0.3, slope: 0.1 };

self.onmessage = function(e) {
    const { type, payload } = e.data;
    switch (type) {
        case 'INIT': init(payload.canvas); break;
        case 'SET_CHROMA': chromaSettings = payload; break;
        case 'SET_OVERLAY': updateTexture('overlay_layer', payload.bitmap); break;
        case 'SET_TRANSITION': 
            texA_id = payload.from;
            texB_id = payload.to;
            transitionTarget = 1.0;
            mixAmount = 0;
            break;
        case 'ADD_SOURCE': updateTexture(payload.id, payload.bitmap); break;
        case 'UPDATE_LAYERS': layers = payload.layers; break;
    }
};

function render() {
    if (!gl) return;
    if (mixAmount < transitionTarget) {
        mixAmount += 0.05;
        if (mixAmount > 1.0) mixAmount = 1.0;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const prog = gl.getParameter(gl.CURRENT_PROGRAM);
    
    // Set Chroma Uniforms
    gl.uniform1i(gl.getUniformLocation(prog, 'u_chromaEnable'), chromaSettings.enabled);
    gl.uniform3fv(gl.getUniformLocation(prog, 'u_keyColor'), new Float32Array(chromaSettings.color));
    gl.uniform1f(gl.getUniformLocation(prog, 'u_threshold'), chromaSettings.threshold);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_slope'), chromaSettings.slope);

    const uMix = gl.getUniformLocation(prog, 'u_mix');
    const uTexA = gl.getUniformLocation(prog, 'u_texA');
    const uTexB = gl.getUniformLocation(prog, 'u_texB');
    const uOverlay = gl.getUniformLocation(prog, 'u_overlay');

    gl.uniform1f(uMix, mixAmount);

    // Draw Overlay Layer (Texture Unit 2)
    renderLayer('overlay_layer', uOverlay, 2);

    if (mixAmount >= 1.0 || texB_id === null) {
        gl.uniform1f(uMix, 1.0);
        renderLayer(texB_id || layers[0]?.sourceId, uTexB, 1);
    } else {
        renderLayer(texA_id, uTexA, 0);
        renderLayer(texB_id, uTexB, 1);
    }
}

function renderLayer(id, location, unit = 0) {
    const tex = textures[id];
    if (tex) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(location, unit);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

function createProgram(gl, vs, fs) {
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vs);
    gl.compileShader(vShader);
    
    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fShader, fs);
    gl.compileShader(fShader);

    const prog = gl.createProgram();
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    return prog;
}
