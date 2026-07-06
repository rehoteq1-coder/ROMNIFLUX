import TitanAudioMixer from './engine/audio-mixer.js';

/**
 * R.OMNIFLUX TITAN ORCHESTRATOR
 * The high-performance brain connecting UI, GPU, and Audio threads.
 */
class OmniFluxTitan {
    constructor() {
        // Multi-threaded Video Pipeline
        this.worker = new Worker('src/engine/compositor.js');
        // Real-time Audio Pipeline
        this.audio = new TitanAudioMixer();
        
        this.sources = new Map();
        this.isInitialized = false;
    }

    async init(canvas) {
        if (this.isInitialized) return;

        // 1. Hand over canvas control to the GPU Worker
        const offscreen = canvas.transferControlToOffscreen();
        this.worker.postMessage({ 
            type: 'INIT', 
            payload: { canvas: offscreen } 
        }, [offscreen]);

        // 2. Audio requires user interaction to start
        document.addEventListener('click', () => {
            this.audio.init();
        }, { once: true });

        this.isInitialized = true;
        console.log("R.OMNIFLUX Titan Engine: READY");
    }

    async addSource() {
        try {
            // Request Pro Constraints
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1920, height: 1080, frameRate: 60 },
                audio: true
            });

            const id = `src_${Date.now()}`;
            this.sources.set(id, { stream });

            // 1. Audio Thread Connection
            await this.audio.connectStream(stream, id, (level) => {
                this.updateVUMeter(id, level);
            });

            // 2. GPU Thread Connection (Zero-Copy Transfer)
            const track = stream.getVideoTracks()[0];
            const processor = new MediaStreamTrackProcessor(track);
            const reader = processor.readable.getReader();

            this.processFrames(id, reader);
            
            // 3. UI Update
            this.createSourceUI(id);
            this.syncLayers();

        } catch (err) {
            console.error("Titan Source Error:", err);
            alert("Broadcast Hardware Access Denied.");
        }
    }

    async processFrames(id, reader) {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Convert to transferable ImageBitmap
            const bitmap = await createImageBitmap(value);
            
            this.worker.postMessage({
                type: 'FRAME',
                payload: { id, bitmap }
            }, [bitmap]);

            value.close(); // Clean up VideoFrame immediately
        }
    }

    syncLayers() {
        const layers = Array.from(this.sources.keys()).map(id => ({ id }));
        this.worker.postMessage({ type: 'UPDATE_LAYERS', payload: layers });
    }

    updateVUMeter(id, level) {
        const vu = document.getElementById(`vu-${id}`);
        if (vu) {
            const height = Math.min(level * 100 * 1.5, 100);
            vu.style.height = `${height}%`;
            vu.style.background = height > 80 ? '#ff2d55' : (height > 50 ? '#ffd60a' : '#00d4ff');
        }
    }

    createSourceUI(id) {
        const list = document.getElementById('source-list');
        if (!list) return;
        const div = document.createElement('div');
        div.style.cssText = 'padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; gap:10px; align-items:center;';
        div.innerHTML = `
            <div style="width:5px; height:30px; background:#111; border-radius:2px; overflow:hidden;">
                <div id="vu-${id}" style="width:100%; height:0%; transition:height 0.1s;"></div>
            </div>
            <div style="font-size:11px; font-weight:bold; letter-spacing:1px;">CAMERA SOURCE</div>
        `;
        list.appendChild(div);
    }
}

window.Studio = new OmniFluxTitan();
