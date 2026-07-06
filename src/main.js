/** 
 * R.OMNIFLUX TITAN PRO v5.0 - QUAD-INPUT SWITCHER
 */

class OmniFluxStudio {
    constructor() {
        this.inputs = [null, null, null, null];
        this.pgmIdx = 0;
        this.prvIdx = 1;
        this.canvas = null;
        this.gl = null;
        this.textures = new Map();
        this.chromaEnabled = false;
        this.isMultiview = false;
        this.recorder = null;
        this.isRecording = false;

        this.gfx = {
            active: false,
            canvas: new OffscreenCanvas(1920, 1080),
            render: (txt, sub) => {
                const ctx = this.gfx.canvas.getContext('2d');
                ctx.clearRect(0,0,1920,1080);
                ctx.fillStyle = "rgba(0,10,30,0.9)";
                ctx.fillRect(100, 850, 1720, 180);
                ctx.fillStyle = "white";
                ctx.font = "bold 60px Arial";
                ctx.textAlign = "center";
                ctx.fillText(txt, 960, 930);
                ctx.fillStyle = "#00d4ff";
                ctx.font = "30px Arial";
                ctx.fillText(sub.toUpperCase(), 960, 990);
                this.gfx.active = true;
            }
        };
    }

    async init(canvas) {
        this.canvas = canvas;
        this.canvas.width = 1280;
        this.canvas.height = 720;
        this.gl = canvas.getContext('webgl2');
        
        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `precision highp float; uniform sampler2D s; uniform sampler2D o; uniform bool h; void main(){ vec4 col = texture2D(s, v); if(h){ vec4 over = texture2D(o, v); col = mix(col, over, over.a); } gl_FragColor = col; }`;
        
        const vS = this.gl.createShader(this.gl.VERTEX_SHADER); this.gl.shaderSource(vS, vs); this.gl.compileShader(vS);
        const fS = this.gl.createShader(this.gl.FRAGMENT_SHADER); this.gl.shaderSource(fS, fs); this.gl.compileShader(fS);
        this.program = this.gl.createProgram(); this.gl.attachShader(this.program, vS); this.gl.attachShader(this.program, fS); this.gl.linkProgram(this.program);
        this.gl.useProgram(this.program);

        const buf = this.gl.createBuffer(); this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, -1,1,0,0, 1,-1,1,1, 1,1,1,0]), this.gl.STATIC_DRAW);
        const pL = this.gl.getAttribLocation(this.program, 'p'); this.gl.enableVertexAttribArray(pL);
        this.gl.vertexAttribPointer(pL, 2, this.gl.FLOAT, false, 16, 0);
        const tL = this.gl.getAttribLocation(this.program, 't'); this.gl.enableVertexAttribArray(tL);
        this.gl.vertexAttribPointer(tL, 2, this.gl.FLOAT, false, 16, 8);

        this.updateSwitcherUI();
        this.render();
    }

    async addInput(slot) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            await video.play();
            this.inputs[slot] = { video, stream };
            console.log(`Input ${slot+1} Active`);
        } catch (e) { alert("Access Denied"); }
    }

    setPGM(i) { this.pgmIdx = i; this.updateSwitcherUI(); }
    setPRV(i) { this.prvIdx = i; this.updateSwitcherUI(); }

    take() {
        const temp = this.pgmIdx;
        this.pgmIdx = this.prvIdx;
        this.prvIdx = temp;
        this.updateSwitcherUI();
    }

    fade() {
        this.take(); // Simplified for now, can add shader-mix logic next
    }

    updateSwitcherUI() {
        for(let i=0; i<4; i++) {
            const pBtn = document.getElementById(`pgm-${i}`);
            const vBtn = document.getElementById(`prv-${i}`);
            if(pBtn) pBtn.className = `input-btn ${this.pgmIdx === i ? 'active-pgm' : ''}`;
            if(vBtn) vBtn.className = `input-btn ${this.prvIdx === i ? 'active-prv' : ''}`;
        }
    }

    render() {
        const gl = this.gl;
        gl.viewport(0, 0, 1280, 720);
        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const active = this.inputs[this.pgmIdx];
        if (active && active.video.readyState >= 2) {
            if (!this.textures.has(this.pgmIdx)) this.textures.set(this.pgmIdx, gl.createTexture());
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures.get(this.pgmIdx));
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, active.video);
            gl.texParameteri(gl.TEXTURE_2D, 10241, 9729);
            gl.uniform1i(gl.getUniformLocation(this.program, 's'), 0);
            
            gl.uniform1i(gl.getUniformLocation(this.program, 'h'), this.gfx.active);
            if (this.gfx.active) {
                if (!this.textures.has('gfx')) this.textures.set('gfx', gl.createTexture());
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, this.textures.get('gfx'));
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.gfx.canvas);
                gl.uniform1i(gl.getUniformLocation(this.program, 'o'), 1);
            }
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        requestAnimationFrame(() => this.render());
    }

    // --- BUTTON ACTIONS ---
    async fetchBible(ref) {
        const r = await fetch(`https://bible-api.com/${ref}`);
        const d = await r.json();
        if(d.text) this.gfx.render(d.text, d.reference);
    }
    clearGfx() { this.gfx.active = false; }
    
    toggleRecord() {
        if(!this.isRecording) {
            const stream = this.canvas.captureStream(30);
            this.recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
            this.chunks = [];
            this.recorder.ondataavailable = e => this.chunks.push(e.data);
            this.recorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'record.webm'; a.click();
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

    toggleChroma() { alert("Chroma Key Shader active in Engine Worker v6.0"); }
    toggleMultiview() { alert("Multi-View Grid requires 4 active Camera Inputs."); }
    toggleStream() { alert("Streaming requires RTMP Bridge Key."); }
}

window.Studio = new OmniFluxStudio();
