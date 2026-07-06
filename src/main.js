/** 
 * R.OMNIFLUX PRO v3.5 - DIAGNOSTIC & RENDER ENGINE
 * Engineered for absolute reliability.
 */

class OmniFluxStudio {
    constructor() {
        this.sources = new Map();
        this.canvas = null;
        this.ctx = null;
        this.gl = null;
        this.renderMode = 'GPU'; // Will fallback to 2D if needed

        this.log = (msg, type = 'info') => {
            const el = document.getElementById('source-list');
            if (el) {
                const color = type === 'error' ? '#ff2d55' : '#00d4ff';
                el.innerHTML = `<div style="color:${color}; font-size:10px; margin-bottom:5px; font-family:monospace;">[${new Date().toLocaleTimeString()}] ${msg}</div>` + el.innerHTML;
            }
            console.log(`[OMNIFLUX] ${msg}`);
        };
    }

    async init(canvas) {
        this.canvas = canvas;
        this.canvas.width = 1280;
        this.canvas.height = 720;
        this.log("Engine Initializing...");

        // 1. Try to start GPU (WebGL2)
        try {
            this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true });
            if (!this.gl) throw new Error("WebGL2 not found, trying WebGL1");
            this.setupWebGL();
            this.log("GPU Pipeline: READY (WebGL2)");
        } catch (e) {
            this.log("GPU Pipeline: FAIL. Falling back to 2D.", 'error');
            this.renderMode = '2D';
            this.ctx = canvas.getContext('2d');
        }

        this.startLoop();
        document.addEventListener('click', () => this.log("User Interaction Detected"), { once: true });
    }

    setupWebGL() {
        const gl = this.gl;
        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `precision highp float; uniform sampler2D s; varying vec2 v; void main(){ gl_FragColor = texture2D(s, v); }`;
        
        const vS = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vS, vs); gl.compileShader(vS);
        const fS = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fS, fs); gl.compileShader(fS);
        this.program = gl.createProgram(); gl.attachShader(this.program, vS); gl.attachShader(this.program, fS); gl.linkProgram(this.program);
        gl.useProgram(this.program);

        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, -1,1,0,0, 1,-1,1,1, 1,1,1,0]), gl.STATIC_DRAW);
        const pL = gl.getAttribLocation(this.program, 'p'); gl.enableVertexAttribArray(pL);
        gl.vertexAttribPointer(pL, 2, gl.FLOAT, false, 16, 0);
        const tL = gl.getAttribLocation(this.program, 't'); gl.enableVertexAttribArray(tL);
        gl.vertexAttribPointer(tL, 2, gl.FLOAT, false, 16, 8);
        this.tex = gl.createTexture();
    }

    async addSource() {
        this.log("Opening System Camera...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: {ideal: 1280}, height: {ideal: 720} }, 
                audio: true 
            });

            const video = document.createElement('video');
            video.setAttribute('autoplay', '');
            video.setAttribute('muted', '');
            video.setAttribute('playsinline', '');
            video.srcObject = stream;
            
            // Critical: Wait for video to actually start
            video.onloadedmetadata = async () => {
                await video.play();
                this.log(`Camera Loaded: ${video.videoWidth}x${video.videoHeight}`);
                this.sources.set('main', { video, stream });
            };

            video.onerror = (e) => this.log("Camera Hardware Error", "error");

        } catch (e) {
            this.log(`Permission Denied: ${e.message}`, "error");
            alert("Please ALLOW camera access in the browser address bar.");
        }
    }

    startLoop() {
        const render = () => {
            if (this.renderMode === 'GPU' && this.gl) {
                this.renderGPU();
            } else if (this.ctx) {
                this.render2D();
            }
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }

    renderGPU() {
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.02, 0.02, 0.05, 1); // Dark Studio Blue
        gl.clear(gl.COLOR_BUFFER_BIT);

        const src = this.sources.get('main');
        if (src && src.video.readyState >= 2) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.video);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }

    render2D() {
        const src = this.sources.get('main');
        this.ctx.fillStyle = '#020205';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (src && src.video.readyState >= 2) {
            this.ctx.drawImage(src.video, 0, 0, this.canvas.width, this.canvas.height);
        }
    }

    // Bible Tool
    async fetchBibleVerse(ref) {
        this.log(`Searching for: ${ref}...`);
        try {
            const res = await fetch(`https://bible-api.com/${ref}`);
            const data = await res.json();
            if (data.text) {
                this.log("Verse found. Displaying...");
                alert(`BIBLE: ${data.text}`); // Temp display until GFX link
            }
        } catch (e) { this.log("Bible lookup failed", "error"); }
    }
}

window.Studio = new OmniFluxStudio();
