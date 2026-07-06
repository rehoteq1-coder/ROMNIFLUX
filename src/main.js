/** 
 * R.OMNIFLUX TITAN v8.0 - WIRELESS & POST-FX 
 */

class OmniFluxStudio {
    constructor() {
        this.inputs = [null, null, null, null];
        this.pgmIdx = 0;
        this.prvIdx = 1;
        this.gl = null;
        this.program = null;
        this.filters = { b: 1.0, c: 1.0, s: 1.0 }; // Brightness, Contrast, Saturation
        this.gfx = { active: false, canvas: new OffscreenCanvas(1920, 1080) };
    }

    async init(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });

        // SHADER v8: Post-Processing Math
        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `
            precision highp float;
            uniform sampler2D s; 
            uniform float b; // Brightness
            uniform float c; // Contrast
            uniform float sat; // Saturation
            varying vec2 v;

            void main(){
                vec4 col = texture2D(s, v);
                
                // 1. Apply Brightness
                col.rgb *= b;
                
                // 2. Apply Contrast
                col.rgb = ((col.rgb - 0.5) * c) + 0.5;
                
                // 3. Apply Saturation
                float grey = dot(col.rgb, vec3(0.299, 0.587, 0.114));
                col.rgb = mix(vec3(grey), col.rgb, sat);
                
                gl_FragColor = col;
            }
        `;
        
        const vS = this.gl.createShader(this.gl.VERTEX_SHADER); this.gl.shaderSource(vS, vs); this.gl.compileShader(vS);
        const fS = this.gl.createShader(this.gl.FRAGMENT_SHADER); this.gl.shaderSource(fS, fs); this.gl.compileShader(fS);
        this.program = this.gl.createProgram(); this.gl.attachShader(this.program, vS); this.gl.attachShader(this.program, fS); this.gl.linkProgram(this.program);
        this.gl.useProgram(this.program);
        this.buf = this.gl.createBuffer();
        
        this.render();
        this.generateQR();
    }

    updateFilter(key, val) {
        this.filters[key] = parseFloat(val);
    }

    // --- WIRELESS SATELLITE LOGIC ---
    generateQR() {
        const url = `https://romniflux.pages.dev/cam?studio=${Math.random().toString(36).substring(7)}`;
        document.getElementById('qr-code').innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(url)}" />`;
    }

    async initWireless() {
        const slot = document.getElementById('wireless-slot').value;
        alert(`Waiting for Wireless Connection on Slot ${parseInt(slot)+1}...`);
        // WebRTC Signaling would go here to ingest the phone feed
    }

    // --- RENDERING PIPELINE ---
    render() {
        const gl = this.gl;
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw PROGRAM with Filters
        this.drawQuad(this.inputs[this.pgmIdx], 0.05, 0, 0.9, 0.9, true);
        
        // Draw PREVIEW (Raw)
        this.drawQuad(this.inputs[this.prvIdx], -0.95, 0, 0.9, 0.9, false);

        requestAnimationFrame(() => this.render());
    }

    drawQuad(src, x, y, w, h, useFilters) {
        if (!src || src.video.readyState < 2) return;
        const gl = this.gl;
        const coords = new Float32Array([x, y-h, 0,1, x+w, y-h, 1,1, x, y, 0,0, x, y, 0,0, x+w, y-h, 1,1, x+w, y, 1,0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
        gl.bufferData(gl.ARRAY_BUFFER, coords, gl.STATIC_DRAW);

        const pL = gl.getAttribLocation(this.program, 'p'); gl.enableVertexAttribArray(pL);
        gl.vertexAttribPointer(pL, 2, gl.FLOAT, false, 16, 0);
        const tL = gl.getAttribLocation(this.program, 't'); gl.enableVertexAttribArray(tL);
        gl.vertexAttribPointer(tL, 2, gl.FLOAT, false, 16, 8);

        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.video);
        gl.texParameteri(gl.TEXTURE_2D, 10241, 9729);

        // Send Filter Data to GPU
        gl.uniform1f(gl.getUniformLocation(this.program, 'b'), useFilters ? this.filters.b : 1.0);
        gl.uniform1f(gl.getUniformLocation(this.program, 'c'), useFilters ? this.filters.c : 1.0);
        gl.uniform1f(gl.getUniformLocation(this.program, 'sat'), useFilters ? this.filters.s : 1.0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.deleteTexture(tex);
    }
    
    // ... include setBus, take, toggleRecord from v7 ...
}
window.Studio = new OmniFluxStudio();
