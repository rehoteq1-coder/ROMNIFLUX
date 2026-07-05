import OmniFluxAudioMixer from './engine/audio-mixer.js';
import GuestManager from './net/guest-manager.js';
import OmniFluxRecorder from './engine/recorder.js';
import OmniFluxGFX from './engine/gfx-engine.js';

class OmniFluxStudio {
    constructor() {
        // Path relative to index.html
        this.worker = new Worker('src/engine/compositor.worker.js');
        this.audio = new OmniFluxAudioMixer();
        this.guests = new GuestManager(this);
        this.gfx = new OmniFluxGFX(this);
        this.recorder = null;
        this.sources = new Map();
    }

    async init(canvas) {
        const offscreen = canvas.transferControlToOffscreen();
        this.worker.postMessage({ type: 'INIT', payload: { canvas: offscreen } }, [offscreen]);
        
        // Audio requires a click to start
        document.addEventListener('click', () => {
            this.audio.init();
        }, { once: true });
        
        console.log("R.OMNIFLUX Studio Engine Ready.");
    }

    async addSource() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1920, height: 1080 },
                audio: true
            });
            const id = `src_${Date.now()}`;
            
            // Audio Pipeline
            await this.audio.connectSource(stream, id, (level) => {
                const vu = document.getElementById(`vu-${id}`);
                if (vu) vu.style.height = `${level * 100}%`;
            });

            // Video Pipeline
            const videoTrack = stream.getVideoTracks()[0];
            const processor = new MediaStreamTrackProcessor(videoTrack);
            const reader = processor.readable.getReader();
            
            this.processSource(id, reader);
            this.sources.set(id, { stream });
            this.createSourceUI(id);
            this.updateLayers();
        } catch (e) {
            alert("Camera failed. Check permissions.");
        }
    }

    async processSource(id, reader) {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const bitmap = await createImageBitmap(value);
            this.worker.postMessage({ type: 'ADD_SOURCE', payload: { id, bitmap } }, [bitmap]);
            value.close();
        }
    }

    updateLayers() {
        const layers = Array.from(this.sources.keys()).map(id => ({ sourceId: id }));
        this.worker.postMessage({ type: 'UPDATE_LAYERS', payload: { layers } });
    }

    createSourceUI(id) {
        const list = document.getElementById('source-list');
        const item = document.createElement('div');
        item.style.cssText = 'padding:10px; border-bottom:1px solid var(--border); display:flex; gap:10px;';
        item.innerHTML = `<div style="width:4px; height:20px; background:#333;"><div id="vu-${id}" style="width:100%; height:0%; background:cyan;"></div></div><span>CAMERA</span>`;
        list.appendChild(item);
    }

    async fetchBibleVerse(ref) {
        const res = await fetch(`https://bible-api.com/${ref}`);
        const data = await res.json();
        if (data.text) this.gfx.renderSlide(data.text, data.reference);
    }

    loadHymnFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const lines = ev.target.result.split('\n');
                this.gfx.renderSlide(lines[0], "Hymn");
            };
            reader.readAsText(e.target.files[0]);
        };
        input.click();
    }

    async toggleRecording() {
        if (!this.recorder) {
            const canvas = document.getElementById('main-canvas');
            this.recorder = new OmniFluxRecorder(canvas.captureStream(60));
            await this.recorder.start();
            document.getElementById('rec-btn').innerText = "🔴 STOP RECORD";
        } else {
            await this.recorder.stop();
            this.recorder = null;
            document.getElementById('rec-btn').innerText = "⏺ REC TO DISK";
        }
    }

    inviteGuest() {
        const code = Math.random().toString(36).substring(7).toUpperCase();
        alert(`GUEST INVITE CODE: ${code}\nSend this to the mobile drone.`);
    }

    setChromaKey(enabled) {
        this.worker.postMessage({ type: 'SET_CHROMA', payload: { enabled, color: [0, 1, 0], threshold: 0.3, slope: 0.1 } });
    }
}

window.Studio = new OmniFluxStudio();
