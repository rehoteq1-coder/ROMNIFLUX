class OmniFluxStudio {
    constructor() {
        this.inputs = [null, null, null, null];
        this.pgmIdx = 0; this.prvIdx = 1;
        this.gl = null; this.program = null;
        this.isRecording = false; this.recorder = null;
        this.filters = { b: 1.0, s: 1.0, c: 1.1 };
        this.chroma = { enabled: false };
        this.hymnLines = []; this.currentHymnIdx = 0;
        this.gfx = { active: false, canvas: new OffscreenCanvas(1920, 1080) };
        this.textures = { pgm: null, prv: null, over: null };
    }

    async init(canvas) {
        this.canvas = canvas; this.canvas.width = 1920; this.canvas.height = 1080;
        this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
        
        // --- UBER SHADER: Chroma + Filters + Overlay ---
        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `
            precision highp float;
            uniform sampler2D s; uniform sampler2D o; uniform bool h; 
            uniform bool chroma; uniform vec3 key; 
            uniform float br; uniform float sat;
            varying vec2 v;
            void main(){
                vec4 col = texture2D(s, v);
                if(chroma && distance(col.rgb, key) < 0.4) col.a = 0.0;
                
                // Post-FX
                col.rgb *= br;
                float grey = dot(col.rgb, vec3(0.299, 0.587, 0.114));
                col.rgb = mix(vec3(grey), col.rgb, sat);
                
                if(h){
                    vec4 over = texture2D(o, v);
                    col = mix(col, over, over.a);
                }
                gl_FragColor = col;
            }
        `;
        
        const vS = this.gl.createShader(this.gl.VERTEX_SHADER); this.gl.shaderSource(vS, vs); this.gl.compileShader(vS);
        const fS = this.gl.createShader(this.gl.FRAGMENT_SHADER); this.gl.shaderSource(fS, fs); this.gl.compileShader(fS);
        this.program = this.gl.createProgram(); this.gl.attachShader(this.program, vS); this.gl.attachShader(this.program, fS); this.gl.linkProgram(this.program);
        this.gl.useProgram(this.program);
        
        this.buf = this.gl.createBuffer();
        this.textures.pgm = this.gl.createTexture();
        this.textures.prv = this.gl.createTexture();
        this.textures.over = this.gl.createTexture();

        this.refreshDevices(); this.updateUI(); this.generateQR(); this.render();
    }

    async refreshDevices() {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const cams = devs.filter(d => d.kind === 'videoinput');
        document.getElementById('device-select').innerHTML = cams.map(c => `<option value="${c.deviceId}">${c.label || 'Camera'}</option>`).join('');
    }

    async assignCamera(slot) {
        const id = document.getElementById('device-select').value;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id }, width: 1280, height: 720 } });
        const video = document.createElement('video'); video.srcObject = stream; video.muted = true; await video.play();
        this.inputs[slot] = { video, stream };
    }

    render() {
        const gl = this.gl;
        gl.clearColor(0, 0, 0.1, 1); gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw PRV (Left)
        this.drawLayer(this.inputs[this.prvIdx], this.textures.prv, -0.95, 0, 0.9, 0.9, false);
        // Draw PGM (Right)
        this.drawLayer(this.inputs[this.pgmIdx], this.textures.pgm, 0.05, 0, 0.9, 0.9, true);

        requestAnimationFrame(() => this.render());
    }

    drawLayer(src, tex, x, y, w, h, applyFx) {
        if (!src || src.video.readyState < 2) return;
        const gl = this.gl;
        const coords = new Float32Array([x,y-h,0,1, x+w,y-h,1,1, x,y,0,0, x,y,0,0, x+w,y-h,1,1, x+w,y,1,0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, coords, gl.STATIC_DRAW);
        
        const pL = gl.getAttribLocation(this.program, 'p'); gl.enableVertexAttribArray(pL);
        gl.vertexAttribPointer(pL, 2, gl.FLOAT, false, 16, 0);
        const tL = gl.getAttribLocation(this.program, 't'); gl.enableVertexAttribArray(tL);
        gl.vertexAttribPointer(tL, 2, gl.FLOAT, false, 16, 8);

        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.video);
        gl.texParameteri(gl.TEXTURE_2D, 10241, 9729);
        gl.uniform1i(gl.getUniformLocation(this.program, 's'), 0);

        // Apply FX only to Program
        gl.uniform1f(gl.getUniformLocation(this.program, 'br'), applyFx ? this.filters.b : 1.0);
        gl.uniform1f(gl.getUniformLocation(this.program, 'sat'), applyFx ? this.filters.s : 1.0);
        gl.uniform1i(gl.getUniformLocation(this.program, 'chroma'), applyFx && this.chroma.enabled);
        
        const hex = document.getElementById('chroma-color').value;
        const rgb = [parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255];
        gl.uniform3fv(gl.getUniformLocation(this.program, 'key'), new Float32Array(rgb));

        gl.uniform1i(gl.getUniformLocation(this.program, 'h'), applyFx && this.gfx.active);
        if (applyFx && this.gfx.active) {
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.textures.over);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.gfx.canvas);
            gl.uniform1i(gl.getUniformLocation(this.program, 'o'), 1);
            gl.activeTexture(gl.TEXTURE0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    generateQR() {
        const id = Math.random().toString(36).substring(7);
        const url = `https://romniflux.pages.dev/join?id=${id}`;
        document.getElementById('qr-box').innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}">`;
    }

    setBus(bus, i) { if(bus==='pgm') this.pgmIdx=i; else this.prvIdx=i; this.updateUI(); }
    take() { [this.pgmIdx, this.prvIdx] = [this.prvIdx, this.pgmIdx]; this.updateUI(); }
    updateUI() {
        for(let i=0; i<4; i++){
            document.getElementById(`pgm-${i}`).className = `btn-input ${this.pgmIdx===i?'active-pgm':''}`;
            document.getElementById(`prv-${i}`).className = `btn-input ${this.prvIdx===i?'active-prv':''}`;
        }
    }
    
    toggleChroma() { this.chroma.enabled = !this.chroma.enabled; document.getElementById('chroma-btn').innerText = this.chroma.enabled?'CHROMA: ON':'CHROMA: OFF'; }

    async fetchBible(ref) {
        const r = await fetch(`https://bible-api.com/${ref}`);
        const d = await r.json();
        if(d.text) this.drawGFX(d.text, d.reference);
    }

    drawGFX(txt, sub) {
        const ctx = this.gfx.canvas.getContext('2d'); ctx.clearRect(0,0,1920,1080);
        ctx.fillStyle = "rgba(0,10,30,0.85)"; ctx.fillRect(100, 850, 1720, 180);
        ctx.fillStyle = "white"; ctx.font = "bold 50px Arial"; ctx.textAlign = "center";
        ctx.fillText(txt.substring(0, 80), 960, 930);
        ctx.fillStyle = "#00d4ff"; ctx.font = "30px Arial"; ctx.fillText(sub, 960, 990);
        this.gfx.active = true;
    }

    clearGfx() { this.gfx.active = false; }

    loadHymn() {
        const inp = document.createElement('input'); inp.type = 'file';
        inp.onchange = e => {
            const reader = new FileReader();
            reader.onload = ev => {
                this.hymnLines = ev.target.result.split('\n').filter(l => l.trim());
                this.currentHymnIdx = 0; this.drawGFX(this.hymnLines[0], "Hymnal");
            };
            reader.readAsText(e.target.files[0]);
        };
        inp.click();
    }
    nextHymnLine() { if(this.currentHymnIdx < this.hymnLines.length-1) this.drawGFX(this.hymnLines[++this.currentHymnIdx], "Hymnal"); }
    prevHymnLine() { if(this.currentHymnIdx > 0) this.drawGFX(this.hymnLines[--this.currentHymnIdx], "Hymnal"); }

    toggleRecord() {
        if(!this.isRecording) {
            this.recorder = new MediaRecorder(this.canvas.captureStream(30));
            this.chunks = []; this.recorder.ondataavailable = e => this.chunks.push(e.data);
            this.recorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'record.webm'; a.click();
            };
            this.recorder.start(); this.isRecording = true; document.getElementById('rec-btn').innerText = "🔴 STOP";
        } else { this.recorder.stop(); this.isRecording = false; document.getElementById('rec-btn').innerText = "⏺ REC"; }
    }
}
window.Studio = new OmniFluxStudio();
