/**
 * R.OMNIFLUX TITAN GPU COMPOSITOR
 * High-performance WebGL2 rendering in a dedicated Worker.
 */
let gl, canvas, program;
let textures = new Map();
let layers = [];

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        canvas = payload.canvas;
        gl = canvas.getContext('webgl2', { 
            antialias: false, 
            depth: false, 
            stencil: false,
            alpha: false,
            preserveDrawingBuffer: true
        });
        
        if (!gl) {
            console.error("Titan Engine: WebGL2 not available in Worker.");
            return;
        }

        const vs = `
            attribute vec2 p;
            attribute vec2 t;
            varying vec2 v;
            void main(){
                gl_Position = vec4(p, 0.0, 1.0);
                v = t;
            }
        `;

        const fs = `
            precision highp float;
            uniform sampler2D s;
            varying vec2 v;
            void main(){
                gl_FragColor = texture2D(s, v);
            }
        `;
        
        const vS = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vS, vs); gl.compileShader(vS);
        const fS = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fS, fs); gl.compileShader(fS);
        program = gl.createProgram(); gl.attachShader(program, vS); gl.attachShader(program, fS); gl.linkProgram(program);
        gl.useProgram(program);

        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        // Full screen quad with tex coords
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 0, 1, 
             1, -1, 1, 1, 
            -1,  1, 0, 0, 
            -1,  1, 0, 0, 
             1, -1, 1, 1, 
             1,  1, 1, 0
        ]), gl.STATIC_DRAW);
        
        const pL = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(pL);
        gl.vertexAttribPointer(pL, 2, gl.FLOAT, false, 16, 0);
        const tL = gl.getAttribLocation(program, 't'); gl.enableVertexAttribArray(tL);
        gl.vertexAttribPointer(tL, 2, gl.FLOAT, false, 16, 8);

        renderLoop();
    }

    if (type === 'UPDATE_LAYERS') {
        layers = payload;
    }

    if (type === 'FRAME') {
        const { id, bitmap } = payload;
        if (!textures.has(id)) {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            textures.set(id, tex);
        }
        gl.bindTexture(gl.TEXTURE_2D, textures.get(id));
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
        bitmap.close(); 
    }
};

function renderLoop() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Titan Renderer: Composite all active layers
    for (const layer of layers) {
        const tex = textures.get(layer.id);
        if (tex) {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }
    
    requestAnimationFrame(renderLoop);
}
