/**
 * R.OMNIFLUX COMPOSITOR WORKER - RELIABILITY V3.1
 */
let gl, canvas, program, positionBuffer;
let textures = {}; 
let layers = [];
let mixAmount = 1.0; // Default to showing the main camera
let chromaSettings = { enabled: false, color: [0, 1, 0], threshold: 0.3, slope: 0.1 };

self.onmessage = function(e) {
    const { type, payload } = e.data;
    switch (type) {
        case 'INIT': init(payload.canvas); break;
        case 'SET_CHROMA': chromaSettings = payload; break;
        case 'SET_OVERLAY': updateTexture('overlay_layer', payload.bitmap); break;
        case 'UPDATE_LAYERS': layers = payload.layers; break;
        case 'ADD_SOURCE': updateTexture(payload.id, payload.bitmap); break;
    }
};

function init(offscreenCanvas) {
    canvas = offscreenCanvas;
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    
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
        uniform bool u_hasOverlay;
        uniform bool u_chromaEnable;
        uniform vec3 u_keyColor;
        uniform float u_threshold;
        varying vec2 v_texCoord;

        void main() {
            vec4 colorB = texture2D(u_texB, v_texCoord);
            vec4 finalColor = colorB;

            if (u_chromaEnable) {
                float d = distance(finalColor.rgb, u_keyColor);
                if (d < u_threshold) discard;
            }

            if (u_hasOverlay) {
                vec4 over = texture2D(u_overlay, v_texCoord);
                finalColor = mix(finalColor, over, over.a);
            }
            gl_FragColor = finalColor;
        }
    `;

    program = createProgram(gl, vsSource, fsSource);
    gl.useProgram(program);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1, 1,1, 0,0, 0,0, 1,1, 1,0]), gl.STATIC_DRAW);
    const aTex = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(aTex);
    gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

    requestAnimationFrame(render);
}

function updateTexture(id, bitmap) {
    if (!textures[id]) textures[id] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textures[id]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    bitmap.close();
}

function render() {
    if (!gl || layers.length === 0) { requestAnimationFrame(render); return; }
    
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const id = layers[0].sourceId;
    if (textures[id]) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures[id]);
        gl.uniform1i(gl.getUniformLocation(program, 'u_texB'), 1);
        
        const hasOver = !!textures['overlay_layer'];
        gl.uniform1i(gl.getUniformLocation(program, 'u_hasOverlay'), hasOver);
        if (hasOver) {
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, textures['overlay_layer']);
            gl.uniform1i(gl.getUniformLocation(program, 'u_overlay'), 2);
        }
        
        gl.uniform1i(gl.getUniformLocation(program, 'u_chromaEnable'), chromaSettings.enabled);
        gl.uniform3fv(gl.getUniformLocation(program, 'u_keyColor'), new Float32Array(chromaSettings.color));
        gl.uniform1f(gl.getUniformLocation(program, 'u_threshold'), chromaSettings.threshold);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    requestAnimationFrame(render);
}

function createProgram(gl, vs, fs) {
    const v = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(v, vs); gl.compileShader(v);
    const f = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f, fs); gl.compileShader(f);
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    return p;
}
