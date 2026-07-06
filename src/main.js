/** 
 * R.OMNIFLUX PRO v3.0 - ALL-IN-ONE BROADCAST ENGINE 
 * Bypasses folder path errors for Sunday Service 
 */

class OmniFluxStudio {
    constructor() {
        this.sources = new Map();
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.textures = new Map();
        
        // Internal GFX Engine
        this.gfx = {
            canvas: new OffscreenCanvas(1920, 1080),
            renderSlide: (text, sub) => {
                const ctx = this.gfx.canvas.getContext('2d');
                ctx.clearRect(0,0,1920,1080);
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(0, 800, 1920, 280);
                ctx.fillStyle = "white";
                ctx.font = "bold 60px Rajdhani";
                ctx.textAlign = "center";
                ctx.fillText(text, 960, 920);
                ctx.font = "30px Rajdhani";
                ctx.fillStyle = "#00d4ff";
                ctx.fillText(sub, 960, 980);
            },
            clear: () => {
                this.gfx.canvas.getContext('2d').clearRect(0,0,1920,1080);
            }
        };
    }

    async init(canvas) {
        this.canvas = canvas;
        this.canvas.width = 1280;
        this.canvas.height = 720;
        this.gl = canvas.getContext('webgl2');
        
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
        console.log("R.OMNIFLUX God-Mode Engine Active");
    }

    async addSource() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const id = `src_${Date.now()}`;
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.play();
            this.sources.set(id, { video, stream });
            this.createSourceUI(id);
        } catch (e) { alert("ERROR: Click the LOCK icon in the browser address bar and ALLOW Camera."); }
    }

    renderLoop() {
        const gl = this.gl;
        gl.viewport(0, 0, 1280, 720);
        gl.clearColor(0, 0, 0.1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const activeId = Array.from(this.sources.keys())[0];
        if (activeId) {
            const src = this.sources.get(activeId);
            if (!this.textures.has(activeId)) this.textures.set(activeId, gl.createTexture());
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures.get(activeId));
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.video);
            gl.texParameteri(gl.TEXTURE_2D, 10241, 9729);
            gl.uniform1i(gl.getUniformLocation(this.program, 's'), 0);
            
            const hasGfx = true; // Always on for stability
            gl.uniform1i(gl.getUniformLocation(this.program, 'h'), hasGfx);
            if (!this.textures.has('gfx')) this.textures.set('gfx', gl.createTexture());
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.textures.get('gfx'));
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.gfx.canvas);
            gl.uniform1i(gl.getUniformLocation(this.program, 'o'), 1);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        requestAnimationFrame(() => this.renderLoop());
    }

    createSourceUI(id) {
        document.getElementById('source-list').innerHTML += `<div style="padding:5px; border:1px solid #00d4ff; margin-bottom:5px; font-size:10px;">CAMERA ACTIVE</div>`;
    }

    async fetchBibleVerse(ref) {
        const res = await fetch(`https://bible-api.com/${ref}`);
        const data = await res.json();
        if (data.text) this.gfx.renderSlide(data.text, data.reference);
    }
}
window.Studio = new OmniFluxStudio();
