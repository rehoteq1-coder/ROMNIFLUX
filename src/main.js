/** 
 * R.OMNIFLUX TITAN PRO v5.5 - DUAL-BUS SWITCHER
 */

class OmniFluxStudio {
    constructor() {
        this.inputs = [null, null, null, null];
        this.pgmIdx = 0;
        this.prvIdx = 1;
        
        // Dual Contexts
        this.glPgm = null;
        this.glPrv = null;
        this.textures = new Map();
        
        this.gfx = { active: false, canvas: new OffscreenCanvas(1920, 1080) };
    }

    async init(pgmCanvas, prvCanvas) {
        // Setup PROGRAM GPU
        this.pgmCanvas = pgmCanvas;
        this.pgmCanvas.width = 1280; this.pgmCanvas.height = 720;
        this.glPgm = pgmCanvas.getContext('webgl2');
        
        // Setup PREVIEW GPU
        this.prvCanvas = prvCanvas;
        this.prvCanvas.width = 1280; this.prvCanvas.height = 720;
        this.glPrv = prvCanvas.getContext('webgl2');

        this.program = this.createShader(this.glPgm);
        this.createShader(this.glPrv); // Initialize both

        this.render();
        this.refreshDeviceList();
    }

    createShader(gl) {
        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `precision highp float; uniform sampler2D s; void main(){ gl_FragColor = texture2D(s, v); }`;
        const vS = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vS, vs); gl.compileShader(vS);
        const fS = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fS, fs); gl.compileShader(fS);
        const prog = gl.createProgram(); gl.attachShader(prog, vS); gl.attachShader(prog, fS); gl.linkProgram(prog);
        gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, -1,1,0,0, 1,-1,1,1, 1,1,1,0]), gl.STATIC_DRAW);
        const pL = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pL);
        gl.vertexAttribPointer(pL, 2, gl.FLOAT, false, 16, 0);
        const tL = gl.getAttribLocation(prog, 't'); gl.enableVertexAttribArray(tL);
        gl.vertexAttribPointer(tL, 2, gl.FLOAT, false, 16, 8);
        return prog;
    }

    async refreshDeviceList() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        console.log("Hardware Found:", cameras);
        // You can now map these IDs to buttons
    }

    async addInput(slot) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            await video.play();
            this.inputs[slot] = { video, stream };
            alert(`Camera assigned to Input ${slot + 1}`);
        } catch (e) { alert("Please allow camera access."); }
    }

    setPGM(i) { this.pgmIdx = i; }
    setPRV(i) { this.prvIdx = i; }

    render() {
        // 1. Render PROGRAM Bus
        this.drawToCanvas(this.glPgm, this.inputs[this.pgmIdx]);
        
        // 2. Render PREVIEW Bus
        this.drawToCanvas(this.glPrv, this.inputs[this.prvIdx]);

        requestAnimationFrame(() => this.render());
    }

    drawToCanvas(gl, input) {
        gl.viewport(0, 0, 1280, 720);
        gl.clearColor(0, 0, 0.1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (input && input.video.readyState >= 2) {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input.video);
            gl.texParameteri(gl.TEXTURE_2D, 10241, 9729);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.deleteTexture(tex); // Cleanup to prevent memory leak
        }
    }

    take() {
        const currentPrv = this.prvIdx;
        this.prvIdx = this.pgmIdx;
        this.pgmIdx = currentPrv;
    }
}
window.Studio = new OmniFluxStudio();
