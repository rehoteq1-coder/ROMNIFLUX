/** 
 * R.OMNIFLUX TITAN PRO v9.0 - UNIFIED BROADCAST ENGINE 
 */

class OmniFluxStudio {
    constructor() {
        this.inputs = [null, null, null, null];
        this.pgmIdx = 0;
        this.prvIdx = 1;
        this.gl = null;
        this.program = null;
        this.isRecording = false;
        this.recorder = null;
        this.chunks = [];
        this.hymnLines = [];
        this.currentHymnIdx = 0;
        this.gfx = { active: false, canvas: new OffscreenCanvas(1920, 1080) };
    }

    async init(canvas) {
        this.canvas = canvas;
        this.canvas.width = 1920;
        this.canvas.height = 1080;
        this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });

        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `precision highp float; uniform sampler2D s; uniform sampler2D o; uniform bool h; varying vec2 v; void main(){ vec4 col = texture2D(s, v); if(h){ vec4 over = texture2D(o, v); col = mix(col, over, over.a); } gl_FragColor = col; }`;
        
        const vS = this.gl.createShader(this.gl.VERTEX_SHADER); this.gl.shaderSource(vS, vs); this.gl.compileShader(vS);
        const fS = this.gl.createShader(this.gl.FRAGMENT_SHADER); this.gl.shaderSource(fS, fs); this.gl.compileShader(fS);
        this.program = this.gl.createProgram(); this.gl.attachShader(this.program, vS); this.gl.attachShader(this.program, fS); this.gl.linkProgram(this.program);
        this.gl.useProgram(this.program);
        this.buf = this.gl.createBuffer();
        
        this.refreshDevices();
        this.updateUI();
        this.generateQR();
        this.render();
    }

    async refreshDevices() {
        try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const cams = devs.filter(d => d.kind === 'videoinput');
            document.getElementById('device-select').innerHTML = cams.map(c => `<option value="${c.deviceId}">${c.label || 'Camera '+c.deviceId.slice(0,4)}</option>`).join('');
        } catch (e) { console.error("Device scan failed"); }
    }

    async assignCamera(slot) {
        const id = document.getElementById('device-select').value;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id }, width: 1280, height: 720 } });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            await video.play();
            this.inputs[slot] = { video, stream };
            console.log(`CAM ${slot+1} Online.`);
        } catch (e) { alert("Camera Access Error. Is another app using it?"); }
    }

    generateQR() {
        const url = `https://romniflux.pages.dev/join?id=${Math.random().toString(36).substring(7)}`;
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
        document.getElementById('qr-box').innerHTML = `<img src="${qr}" alt="Scan to Connect">`;
    }

    render() {
        const gl = this.gl;
        gl.clearColor(0, 0, 0.05, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw Monitors: PRV (Left), PGM (Right)
        this.drawQuad(this.inputs[this.prvIdx], -0.95, 0, 0.9, 0.9, false);
        this.drawQuad(this.inputs[this.pgmIdx], 0.05, 0, 0.9, 0.9, true);

        requestAnimationFrame(() => this.render());
    }

    drawQuad(src, x, y, w, h, applyGfx) {
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

        gl.uniform1i(gl.getUniformLocation(this.program, 'h'), applyGfx && this.gfx.active);
        if (applyGfx && this.gfx.active) {
            const gTex = gl.createTexture();
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, gTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.gfx.canvas);
            gl.uniform1i(gl.getUniformLocation(this.program, 'o'), 1);
            gl.activeTexture(gl.TEXTURE0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.deleteTexture(tex);
    }

    setBus(bus, i) { if(bus==='pgm') this.pgmIdx=i; else this.prvIdx=i; this.updateUI(); }
    take() { [this.pgmIdx, this.prvIdx] = [this.prvIdx, this.pgmIdx]; this.updateUI(); }
    updateUI() {
        for(let i=0; i<4; i++){
            document.getElementById(`pgm-${i}`).className = `btn-input ${this.pgmIdx===i?'active-pgm':''}`;
            document.getElementById(`prv-${i}`).className = `btn-input ${this.prvIdx===i?'active-prv':''}`;
        }
    }

    // --- WORSHIP & TITLES ---
    updateEventInfo() {
        const title = document.getElementById('event-title').value;
        const name = document.getElementById('speaker-name').value;
        this.renderGFX(title, name);
    }

    async fetchBible(ref) {
        const r = await fetch(`https://bible-api.com/${ref}`);
        const d = await r.json();
        if(d.text) this.renderGFX(d.text, d.reference);
    }

    renderGFX(txt, sub) {
        const ctx = this.gfx.canvas.getContext('2d');
        ctx.clearRect(0,0,1920,1080);
        ctx.fillStyle = "rgba(0,10,30,0.85)";
        ctx.fillRect(100, 850, 1720, 180);
        ctx.fillStyle = "white"; ctx.font = "bold 50px Arial"; ctx.textAlign = "center";
        ctx.fillText(txt.substring(0, 85), 960, 930);
        ctx.fillStyle = "#00d4ff"; ctx.font = "30px Arial";
        ctx.fillText(sub.toUpperCase(), 960, 990);
        this.gfx.active = true;
    }

    clearGfx() { this.gfx.active = false; }

    toggleRecord() {
        if(!this.isRecording) {
            this.recorder = new MediaRecorder(this.canvas.captureStream(30), { mimeType: 'video/webm' });
            this.chunks = [];
            this.recorder.ondataavailable = e => this.chunks.push(e.data);
            this.recorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'omniflux-capture.webm'; a.click();
            };
            this.recorder.start();
            this.isRecording = true;
            document.getElementById('rec-btn').innerText = "🔴 STOPPING...";
        } else {
            this.recorder.stop();
            this.isRecording = false;
            document.getElementById('rec-btn').innerText = "⏺ REC TO DISK";
        }
    }
}
window.Studio = new OmniFluxStudio();
