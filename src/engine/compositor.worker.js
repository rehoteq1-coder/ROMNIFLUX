let gl, canvas, program;
let textures = new Map();
let layers = [];

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        canvas = payload.canvas;
        gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
        setupGL();
        render();
    }
    if (type === 'UPDATE_LAYERS') layers = payload;
    if (type === 'FRAME') {
        updateTexture(payload.id, payload.bitmap);
    }
};

function setupGL() {
    const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
    const fs = `precision highp float; uniform sampler2D s; varying vec2 v; void main(){ gl_FragColor = texture2D(s, v); }`;
    
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
}

function updateTexture(id, bitmap) {
    if (!textures.has(id)) textures.set(id, gl.createTexture());
    gl.bindTexture(gl.TEXTURE_2D, textures.get(id));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    bitmap.close();
}

function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    layers.forEach(layer => {
        const tex = textures.get(layer.id);
        if (tex) {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    });
    requestAnimationFrame(render);
}
