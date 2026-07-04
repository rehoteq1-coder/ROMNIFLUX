/**
 * R.OMNIFLUX MAIN ORCHESTRATOR
 */

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
        this.recorder = null;
        this.currentPgmId = null;
        this.sources = new Map();
    }

    // --- BIBLE MODULE ---
    async fetchBibleVerse(reference) {
        try {
            const res = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}`);
            const data = await res.json();
            if (data.text) {
                this.gfx.renderSlide(data.text.trim(), data.reference);
            }
        } catch (e) {
            console.error("Bible Lookup Failed", e);
        }
    }

    // --- HYMN / FILE MODULE ---
    loadHymnFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const lines = event.target.result.split('\n').filter(l => l.trim() !== '');
                this.displayHymn(lines, file.name.replace('.txt', ''));
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // --- REMOTE & DRONE INGEST ---
    async addRemoteSource(url, type = 'hls') {
        const sourceId = `remote_${Date.now()}`;
        const video = document.createElement('video');
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;

        if (type === 'hls') {
            // Use HLS.js for .m3u8 feeds from Drones/IP Cams
            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
            } else {
                video.src = url;
            }
        }

        video.onloadedmetadata = () => {
            video.play();
            const stream = video.captureStream();
            const processor = new MediaStreamTrackProcessor(stream.getVideoTracks()[0]);
            this.processSource(sourceId, processor.readable.getReader());
            this.sources.set(sourceId, { type: 'remote', stream });
            this.updateLayers();
        };
    }

    // Call this to transition between sources
    transition(toId) {
        this.worker.postMessage({
            type: 'SET_TRANSITION',
            payload: { from: this.currentPgmId, to: toId }
        });
        this.currentPgmId = toId;
    }

    async setChromaKey(enabled, colorHex = '#00ff00', threshold = 0.3) {
        // Convert hex to RGB 0-1
        const r = parseInt(colorHex.slice(1,3), 16) / 255;
        const g = parseInt(colorHex.slice(3,5), 16) / 255;
        const b = parseInt(colorHex.slice(5,7), 16) / 255;

        this.worker.postMessage({
            type: 'SET_CHROMA',
            payload: { enabled, color: [r, g, b], threshold, slope: 0.1 }
        });
    }

    async uploadOverlay() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            const bitmap = await createImageBitmap(file);
            this.worker.postMessage({
                type: 'SET_OVERLAY',
                payload: { bitmap }
            }, [bitmap]);
        };
        input.click();
    }

    // ... (init and addSource remain same, updating to include Stats)

    registerGuestStream(guestId, stream) {
        const sourceId = `guest_${guestId}`;
        const videoTrack = stream.getVideoTracks()[0];
        const processor = new MediaStreamTrackProcessor(videoTrack);
        
        this.processSource(sourceId, processor.readable.getReader());
        this.audio.connectSource(stream, sourceId, (level) => this.updateVUMeter(sourceId, level));
        
        this.sources.set(sourceId, { type: 'guest', stream });
        this.layoutMultiGuest();
    }

    layoutMultiGuest() {
        // Auto-layout logic: Side-by-Side
        const activeSources = Array.from(this.sources.keys());
        const count = activeSources.length;
        
        const layers = activeSources.map((id, index) => {
            return {
                sourceId: id,
                x: (index / count), 
                y: 0,
                w: 1 / count,
                h: 1
            };
        });

        this.worker.postMessage({ type: 'UPDATE_LAYERS', payload: { layers } });
    }

    startStatsMonitor() {
        let frameCount = 0;
        let lastTime = performance.now();

        const update = () => {
            frameCount++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                this.stats.fps = frameCount;
                this.updateStatsUI();
                frameCount = 0;
                lastTime = now;
            }
            requestAnimationFrame(update);
        };
        update();
    }

    updateStatsUI() {
        const el = document.getElementById('perf-stats');
        const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
        const h = Math.floor(uptime/3600), m = Math.floor((uptime%3600)/60), s = uptime%60;
        
        if (el) {
            el.innerHTML = `
                GPU: ACTIVE | ${this.stats.fps} FPS | 
                UPTIME: ${h}:${m}:${s} | 
                GUESTS: ${this.sources.size - 1}
            `;
        }
    }
}

    async init(canvasElement) {
        const offscreen = canvasElement.transferControlToOffscreen();
        this.worker.postMessage({
            type: 'INIT',
            payload: { canvas: offscreen }
        }, [offscreen]);

        // Initialize Audio on first user interaction
        document.addEventListener('click', () => this.audio.init(), { once: true });
        
        console.log("OmniFlux Studio Engine v3.0 (Multithreaded) Ready.");
    }

    async addSource() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1920, height: 1080, frameRate: 60 },
                audio: true
            });

            const sourceId = `src_${Date.now()}`;
            
            // 1. Video Pipeline (GPU Worker)
            const videoTrack = stream.getVideoTracks()[0];
            const processor = new MediaStreamTrackProcessor(videoTrack);
            this.processSource(sourceId, processor.readable.getReader());

            // 2. Audio Pipeline (Worklet Thread)
            await this.audio.connectSource(stream, sourceId, (level) => {
                this.updateVUMeter(sourceId, level);
            });

            this.sources.set(sourceId, { stream });
            this.programLayerId = sourceId;
            this.updateLayers();
            this.createSourceUI(sourceId);
            
            return sourceId;
        } catch (e) {
            console.error("Source Capture Failed:", e);
        }
    }

    updateVUMeter(id, level) {
        // level is 0 to 1. Translate to CSS height.
        const vu = document.getElementById(`vu-${id}`);
        if (vu) {
            const height = Math.min(level * 100 * 1.5, 100);
            vu.style.height = `${height}%`;
            // Color grading
            vu.style.background = height > 85 ? '#ff2d55' : (height > 60 ? '#ffd60a' : '#00d4ff');
        }
    }

    createSourceUI(id) {
        const list = document.getElementById('source-list');
        const item = document.createElement('div');
        item.style.cssText = 'padding:10px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px;';
        item.innerHTML = `
            <div style="width:4px; height:30px; background:#1a1d26; position:relative; overflow:hidden; border-radius:2px;">
                <div id="vu-${id}" style="position:absolute; bottom:0; width:100%; height:0%; transition:height 0.1s; background:var(--accent);"></div>
            </div>
            <div style="font-size:12px;">CAM SOURCE</div>
        `;
        list.appendChild(item);
    }

    async processSource(id, reader) {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // value is a VideoFrame. We convert to ImageBitmap for the Worker
            const bitmap = await createImageBitmap(value);
            
            this.worker.postMessage({
                type: 'ADD_SOURCE',
                payload: { id, bitmap }
            }, [bitmap]);

            value.close(); // Release hardware decoder lock immediately
        }
    }

    updateLayers() {
        this.worker.postMessage({
            type: 'UPDATE_LAYERS',
            payload: {
                layers: [
                    { sourceId: this.programLayerId }
                ]
            }
        });
    }
}

// Global instance
window.Studio = new OmniFluxStudio();

// Global instance
window.Studio = new OmniFluxStudio();
