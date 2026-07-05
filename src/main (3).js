import OmniFluxAudioMixer from './engine/audio-mixer.js';
import GuestManager from './net/guest-manager.js';
import OmniFluxRecorder from './engine/recorder.js';
import OmniFluxGFX from './engine/gfx-engine.js';

class OmniFluxStudio {
    constructor() {
        this.worker = new Worker('src/engine/compositor.worker.js');
        this.audio = new OmniFluxAudioMixer();
        this.guests = new GuestManager(this);
        this.gfx = new OmniFluxGFX(this);
        this.sources = new Map();
        this.isInitialized = false;
    }

    async init(canvas) {
        if (this.isInitialized) return;
        
        // Ensure canvas has a physical size
        canvas.width = 1280;
        canvas.height = 720;
        
        const offscreen = canvas.transferControlToOffscreen();
        this.worker.postMessage({ type: 'INIT', payload: { canvas: offscreen } }, [offscreen]);
        
        document.addEventListener('click', () => {
            this.audio.init();
        }, { once: true });
        
        this.isInitialized = true;
        console.log("Universal Engine Initialized");
    }

    async addSource() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true
            });
            const id = `src_${Date.now()}`;
            this.sources.set(id, { stream });

            // 1. Start Audio
            await this.audio.connectSource(stream, id, (level) => {
                const vu = document.getElementById(`vu-${id}`);
                if (vu) vu.style.height = `${level * 100}%`;
            });

            // 2. Start Video Fallback Pipeline (The OBS Stability Way)
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.play();

            const sendFrame = () => {
                if (video.readyState >= 2) {
                    createImageBitmap(video).then(bitmap => {
                        this.worker.postMessage({ type: 'ADD_SOURCE', payload: { id, bitmap } }, [bitmap]);
                    });
                }
                requestAnimationFrame(sendFrame);
            };
            sendFrame();

            this.createSourceUI(id);
            this.updateLayers();
        } catch (e) {
            console.error("Camera Error:", e);
        }
    }

    updateLayers() {
        const layers = Array.from(this.sources.keys()).map(id => ({ sourceId: id }));
        this.worker.postMessage({ type: 'UPDATE_LAYERS', payload: { layers } });
    }

    createSourceUI(id) {
        const list = document.getElementById('source-list');
        const item = document.createElement('div');
        item.style.cssText = 'padding:10px; border-bottom:1px solid var(--border); display:flex; gap:10px; align-items:center;';
        item.innerHTML = `<div style="width:4px; height:20px; background:#333; overflow:hidden;"><div id="vu-${id}" style="width:100%; height:0%; background:cyan; transition: height 0.1s;"></div></div><span>LIVE CAMERA</span>`;
        list.appendChild(item);
    }

    async fetchBibleVerse(ref) {
        try {
            const res = await fetch(`https://bible-api.com/${ref}`);
            const data = await res.json();
            if (data.text) this.gfx.renderSlide(data.text, data.reference);
        } catch (e) { alert("Bible not found"); }
    }

    loadHymnFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const lines = ev.target.result.split('\n').filter(l => l.trim());
                this.gfx.renderSlide(lines[0], "Hymn");
            };
            reader.readAsText(e.target.files[0]);
        };
        input.click();
    }
}

window.Studio = new OmniFluxStudio();
