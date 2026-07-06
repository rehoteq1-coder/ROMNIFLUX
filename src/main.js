/** 
 * R.OMNIFLUX TITAN ENGINE v6.0 - THE MULTIVIEWER 
 */

class OmniFluxStudio {
    constructor() {
        this.inputs = [null, null, null, null];
        this.pgmIdx = 0; // Bus A
        this.prvIdx = 1; // Bus B
        this.canvas = null;
        this.gl = null;
        this.textures = new Map();
        this.isRecording = false;
        this.gfx = { active: false, canvas: new OffscreenCanvas(1920, 1080) };
    }

    async init(canvas) {
        this.canvas = canvas;
        this.canvas.width = 1920; // High Res internal
        this.canvas.height = 1080;
        
        this.gl = canvas.getContext('webgl2');
        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `precision highp float; uniform sampler2D s; varying vec2 v; void main(){ gl_FragColor = texture2D(s, v); }`;
        
        const vS = this.gl.createShader(this.gl.VERTEX_SHADER); this.gl.shaderSource(vS, vs); this.gl.compileShader(vS);
        const fS = this.gl.createShader(this.gl.FRAGMENT_SHADER); this.gl.shaderSource(fS, fs); this.gl.compileShader(fS);
        this.program = this.gl.createProgram(); this.gl.attachShader(this.program, vS); this.gl.attachShader(this.program, fS); this.gl.linkProgram(this.program);
        this.gl.useProgram(this.program);

        this.buf = this.gl.createBuffer();
        this.updateUI();
        this.render();
    }

    async activateInput(idx) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {width: 1280, height: 720}, audio: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            await video.play();
            this.inputs[idx] = { video, stream };
            console.log(`Input ${idx+1} Online`);
        } catch (e) { alert("Camera Access Error"); }
    }

    setBus(type, idx) {
        if (type === 'pgm') this.pgmIdx = idx;
        else this.prvIdx = idx;
        this.updateUI();
    }

    take() {
        const temp = this.pgmIdx;
        this.pgmIdx = this.prvIdx;
        this.prvIdx = temp;
        this.updateUI();
    }

    updateUI() {
        for(let i=0; i<4; i++) {
            document.getElementById(`pgm-${i}`).className = `btn-input ${this.pgmIdx === i ? 'active-pgm' : ''}`;
            document.getElementById(`prv-${i}`).className = `btn-input ${this.prvIdx === i ? 'active-prv' : ''}`;
        }
    }

    render() {
        const gl = this.gl;
        gl.clearColor(0, 0, 0.1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 1. DRAW PREVIEW (Left Half)
        this.drawLayer(this.inputs[this.prvIdx], -0.95, 0, 0.9, 0.9);
        
        // 2. DRAW PROGRAM (Right Half)
        this.drawLayer(this.inputs[this.pgmIdx], 0.05, 0, 0.9, 0.9);

        // 3. DRAW BIBLE OVERLAY (Over Program)
        if (this.gfx.active) {
            this.drawLayer({video: this.gfx.canvas, isGfx: true}, 0.05, 0, 0.9, 0.9);
        }

        requestAnimationFrame(() => this.render());
    }

    drawLayer(src, x, y, w, h) {
        if (!src || (src.video && src.video.readyState < 2)) return;
        const gl = this.gl;
        
        // Set coordinates for this quadrant
        const coords = new Float32Array([
            x, y-h, 0,1,  x+w, y-h, 1,1,  x, y, 0,0,
            x, y, 0,0,    x+w, y-h, 1,1,  x+w, y, 1,0
        ]);
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
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.deleteTexture(tex);
    }

    async fetchBible(ref) {
        const res = await fetch(`https://bible-api.com/${ref}`);
        const data = await res.json();
        if (data.text) {
            const ctx = this.gfx.canvas.getContext('2d');
            ctx.clearRect(0,0,1920,1080);
            ctx.fillStyle = "rgba(0,0,0,0.8)";
            ctx.fillRect(100, 800, 1720, 200);
            ctx.fillStyle = "white";
            ctx.font = "bold 50px Arial";
            ctx.textAlign = "center";
            ctx.fillText(data.text.substring(0, 100), 960, 900);
            this.gfx.active = true;
        }
    }
    clearGfx() { this.gfx.active = false; }
}

window.Studio = new OmniFluxStudio();
