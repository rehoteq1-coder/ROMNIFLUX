/** 
 * R.OMNIFLUX TITAN PRO v4.0 - MASTER SUITE
 * High-Performance GPU Compositing + Worship Tools
 */

class OmniFluxStudio {
    constructor() {
        this.sources = new Map();
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.textures = new Map();
        
        // --- PRO GFX ENGINE ---
        this.gfx = {
            canvas: new OffscreenCanvas(1920, 1080),
            active: false,
            renderSlide: (text, sub) => {
                const ctx = this.gfx.canvas.getContext('2d');
                ctx.clearRect(0,0,1920,1080);
                // Cinematic Lower Third
                ctx.fillStyle = "rgba(0,0,0,0.7)";
                ctx.fillRect(100, 850, 1720, 180);
                ctx.strokeStyle = "#00d4ff";
                ctx.lineWidth = 5;
                ctx.strokeRect(100, 850, 1720, 180);
                // Typography
                ctx.fillStyle = "white";
                ctx.font = "bold 60px Rajdhani";
                ctx.textAlign = "center";
                ctx.fillText(text.substring(0, 80), 960, 930);
                ctx.font = "30px Rajdhani";
                ctx.fillStyle = "#00d4ff";
                ctx.fillText(sub.toUpperCase(), 960, 990);
                this.gfx.active = true;
                this.log("OVERLAY: " + sub);
            },
            clear: () => {
                this.gfx.canvas.getContext('2d').clearRect(0,0,1920,1080);
                this.gfx.active = false;
                this.log("Display Cleared.");
            }
        };

        this.log = (msg) => {
            const el = document.getElementById('source-list');
            if (el) el.innerHTML = `<div style="color:#00d4ff; font-size:10px; margin-bottom:4px; font-family:monospace;">> ${msg}</div>` + el.innerHTML;
        };
    }

    async init(canvas) {
        this.canvas = canvas;
        this.canvas.width = 1280;
        this.canvas.height = 720;
        this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
        
        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `precision highp float; uniform sampler2D s; uniform sampler2D o; uniform bool h; varying vec2 v; void main(){ vec4 col = texture2D(s, v); if(h){ vec4 over = texture2D(o, v); col = mix(col, over, over.a); } gl_FragColor = col; }`;
        
        const vS = this.gl.createShader(this.gl.VERTEX_SHADER); this.gl.shaderSource(vS, vs); this.gl.compileShader(vS);
        const fS = this.gl.createShader(this.gl.FRAGMENT_SHADER); this.gl.shaderSource(fS, fs); this.gl.compileShader(fS);
        this.program = this.gl.createProgram(); this.gl.attachShader(this.program, vS); this.gl.attachShader(this.program, fS); this.gl.linkProgram(this.program);
        this.gl.useProgram(this.program);

        const buf = this.gl.createBuffer(); this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, -1,1,0,0, 1,-1,1,1, 1,1,1,0]), gl.STATIC_DRAW);
        const pL = gl.getAttribLocation(this.program, 'p'); gl.enableVertexAttribArray(pL);
        gl.vertexAttribPointer(pL, 2, gl.FLOAT, false, 16, 0);
        const tL = gl.getAttribLocation(this.program, 't'); gl.enableVertexAttribArray(tL);
        gl.vertexAttribPointer(tL, 2, gl.FLOAT, false, 16, 8);

        this.renderLoop();
        this.log("Titan Pro Engine: READY");
    }

    async addSource() {
        this.log("Connecting Hardware...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {width:1280, height:720}, audio: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.play();
            
            video.onloadedmetadata = () => {
                this.sources.set('main', { video, stream });
                this.log("BROADCAST SIGNAL LOCKED");
            };
        } catch (e) { this.log("Camera Permission Denied", "error"); }
    }

    renderLoop() {
        const gl = this.gl;
        gl.viewport(0, 0, 1280, 720);
        gl.clearColor(0.01, 0.01, 0.02, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const src = this.sources.get('main');
        if (src && src.video.readyState >= 2) {
            if (!this.textures.has('main')) this.textures.set('main', gl.createTexture());
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures.get('main'));
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.video);
            gl.texParameteri(gl.TEXTURE_2D, 10241, 9729);
            gl.uniform1i(gl.getUniformLocation(this.program, 's'), 0);
            
            // Draw Overlays
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
        requestAnimationFrame(() => this.renderLoop());
    }

    async fetchBibleVerse(ref) {
        if(!ref) return;
        this.log("Fetching: " + ref);
        try {
            const res = await fetch(`https://bible-api.com/${ref}`);
            const data = await res.json();
            if (data.text) this.gfx.renderSlide(data.text, data.reference);
        } catch (e) { this.log("Bible API Error"); }
    }
}
window.Studio = new OmniFluxStudio();
