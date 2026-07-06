import OmniFluxAudioMixer from './engine/audio-mixer.js';
import GuestManager from './net/guest-manager.js';
import OmniFluxRecorder from './engine/recorder.js';
import OmniFluxGFX from './engine/gfx-engine.js';

class OmniFluxStudio {
    constructor() {
        this.audio = new OmniFluxAudioMixer();
        this.guests = new GuestManager(this);
        this.gfx = new OmniFluxGFX(this);
        this.sources = new Map();
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.textures = new Map();
        this.chroma = { enabled: false, color: [0, 1, 0], threshold: 0.35 };
    }

    async init(canvas) {
        this.canvas = canvas;
        this.canvas.width = 1280;
        this.canvas.height = 720;
        
        this.gl = canvas.getContext('webgl2');
        const vs = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){ gl_Position=vec4(p,0,1); v=t; }`;
        const fs = `precision highp float; uniform sampler2D s; uniform sampler2D o; uniform bool h; uniform bool c; uniform vec3 k; uniform float th; varying vec2 v; void main(){ vec4 col = texture2D(s, v); if(c){ float d = distance(col.rgb, k); if(d < th) discard; } if(h){ vec4 over = texture2D(o, v); col = mix(col, over, over.a); } gl_FragColor = col; }`;

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
    }

    async addSource() {
        console.log("Activating Camera...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const id = `src_${Date.now()}`;
            
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.play();

            this.sources.set(id, { video, stream });
            
            // Try to connect audio, but don't stop the video if it fails
            this.audio.init().then(() => {
                this.audio.connectSource(stream, id, (level) => {
                    const vu = document.getElementById(`vu-${id}`);
                    if (vu) vu.style.height = `${level * 100}%`;
                });
            }).catch(e => console.warn("Audio engine delay"));

            this.createSourceUI(id);
        } catch (e) {
            alert("CAMERA ERROR: Please click 'Allow' on the browser pop-up.");
        }
    }

    renderLoop() {
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.05, 0.05, 0.1, 1);
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
            
            const hasGfx = !!this.gfx.canvas;
            gl.uniform1i(gl.getUniformLocation(this.program, 'h'), hasGfx);
            if (hasGfx) {
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

    createSourceUI(id) {
        const list = document.getElementById('source-list');
        if (list) list.innerHTML = `<div style="padding:10px; border:1px solid #00d4ff; font-size:10px;">CAM ACTIVE<div id="vu-${id}" style="height:2px; background:cyan; width:0%"></div></div>`;
    }

    async fetchBibleVerse(ref) {
        const res = await fetch(`https://bible-api.com/${ref}`);
        const data = await res.json();
        if (data.text) this.gfx.renderSlide(data.text, data.reference);
    }
}
window.Studio = new OmniFluxStudio();
