/** 
 * R.OMNIFLUX TITAN PRO v4.1 - ADAPTIVE MASTER
 * Fixes "Dark Screen" by auto-detecting camera resolution.
 */

class OmniFluxStudio {
    constructor() {
        this.sources = new Map();
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.textures = new Map();
        this.gfx = {
            canvas: new OffscreenCanvas(1920, 1080),
            active: false,
            renderSlide: (text, sub) => {
                const ctx = this.gfx.canvas.getContext('2d');
                ctx.clearRect(0,0,1920,1080);
                ctx.fillStyle = "rgba(0,0,0,0.8)";
                ctx.fillRect(0, 850, 1920, 230);
                ctx.fillStyle = "white";
                ctx.font = "bold 60px Arial";
                ctx.textAlign = "center";
                ctx.fillText(text.substring(0, 70), 960, 940);
                ctx.fillStyle = "#00d4ff";
                ctx.font = "30px Arial";
                ctx.fillText(sub.toUpperCase(), 960, 1000);
                this.gfx.active = true;
            },
            clear: () => { this.gfx.active = false; }
        };
        this.log = (msg) => {
            const el = document.getElementById('source-list');
            if (el) el.innerHTML = `<div style="color:#00d4ff; font-size:10px; margin-bottom:2px;">> ${msg}</div>` + el.innerHTML;
        };
    }

    async init(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
        
        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `precision highp float; uniform sampler2D s; uniform sampler2D o; uniform bool h; varying vec2 v; void main(){ vec4 col = texture2D(s, v); if(h){ vec4 over = texture2D(o, v); col = mix(col, over, over.a); } gl_FragColor = col; }`;
        
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

        this.renderLoop();
        this.log("Engine: ADAPTIVE MODE ACTIVE");
    }

    async addSource() {
        this.log("Requesting Signal...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.setAttribute('playsinline', '');
            await video.play();
            
            // AUTO-ADAPT: Set canvas to match camera exactly
            this.canvas.width = video.videoWidth;
            this.canvas.height = video.videoHeight;
            this.log(`Source Locked: ${video.videoWidth}x${video.videoHeight}`);

            this.sources.set('main', { video, stream });
        } catch (e) { this.log("Signal Denied."); }
    }

    renderLoop() {
        const gl = this.gl;
        if (!gl) return;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0.1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const src = this.sources.get('main');
        if (src && src.video.readyState >= 2) {
            if (!this.textures.has('main')) this.textures.set('main', gl.createTexture());
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures.get('main'));
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.video);
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
        requestAnimationFrame(() => this.renderLoop());
    }

    async fetchBibleVerse(ref) {
        if(!ref) return;
        this.log("Searching: " + ref);
        const res = await fetch(`https://bible-api.com/${ref}`);
        const data = await res.json();
        if (data.text) this.gfx.renderSlide(data.text, data.reference);
    }
}
window.Studio = new OmniFluxStudio();
