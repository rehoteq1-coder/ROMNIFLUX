/**
 * R.OMNIFLUX GPU COMPOSITOR - FORCED VISIBILITY
 */
let gl, canvas, program;
let textures = {}; 
let layers = [];
let chromaSettings = { enabled: false, color: [0, 1, 0], threshold: 0.3 };

self.onmessage = function(e) {
    const { type, payload } = e.data;
    if (type === 'INIT') init(payload.canvas);
    if (type === 'ADD_SOURCE') updateTexture(payload.id, payload.bitmap);
    if (type === 'UPDATE_LAYERS') layers = payload.layers;
};

function init(offscreen) {
    canvas = offscreen;
    gl = canvas.getContext('webgl2');
    
    const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
    const fs = `precision highp float; uniform sampler2D s; uniform sampler2D o; uniform bool h; varying vec2 v; void main(){ vec4 c = texture2D(s, v); if(h){ vec4 over = texture2D(o, v); c = mix(c, over, over.a); } gl_FragColor = c; }`;

    const vS = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vS, vs); gl.compileShader(vS);
    const fS = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fS, fs); gl.compileShader(fS);
    program = gl.createProgram(); gl.attachShader(program, vS); gl.attachShader(program, fS); gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, -1,1,0,0, 1,-1,1,1, 1,1,1,0]), gl.STATIC_DRAW);
    
    const pL = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(pL);
    gl.vertexAttribPointer(pL, 2, gl.FLOAT, false, 16, 0);
    const tL = gl.getAttribLocation(program, 't'); gl.enableVertexAttribArray(tL);
    gl.vertexAttribPointer(tL, 2, gl.FLOAT, false, 16, 8);

    render();
}

function updateTexture(id, bitmap) {
    if (!gl) return;
    if (!textures[id]) textures[id] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textures[id]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, 33071, 33071);
    gl.texParameteri(gl.TEXTURE_2D, 33070, 33071);
    gl.texParameteri(gl.TEXTURE_2D, 10241, 9729);
    bitmap.close();
}

function render() {
    if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.1, 0, 0.2, 1); // Dark Purple Background (If you see this, GPU is ALIVE)
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (layers.length > 0) {
            const id = layers[0].sourceId;
            if (textures[id]) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, textures[id]);
                gl.uniform1i(gl.getUniformLocation(program, 's'), 0);
                
                const hasOver = !!textures['overlay_layer'];
                gl.uniform1i(gl.getUniformLocation(program, 'h'), hasOver);
                if (hasOver) {
                    gl.activeTexture(gl.TEXTURE1);
                    gl.bindTexture(gl.TEXTURE_2D, textures['overlay_layer']);
                    gl.uniform1i(gl.getUniformLocation(program, 'o'), 1);
                }
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
        }
    }
    requestAnimationFrame(render);
}
