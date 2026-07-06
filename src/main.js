import TitanAudioMixer from './engine/audio-mixer.js';

class OmniFluxTitan {
    constructor() {
        // PRO PATH RESOLUTION: Ensures the Worker is found regardless of root
        const workerPath = new URL('./engine/compositor.js', import.meta.url);
        this.worker = new Worker(workerPath);
        
        this.audio = new TitanAudioMixer();
        this.sources = new Map();
        
        // Debugging
        this.worker.onerror = (e) => console.error("Worker Error:", e);
    }

    async init(canvas) {
        // Force hardware resolution
        const rect = canvas.getBoundingClientRect();
        canvas.width = 1280;
        canvas.height = 720;
        
        const offscreen = canvas.transferControlToOffscreen();
        this.worker.postMessage({ 
            type: 'INIT', 
            payload: { canvas: offscreen } 
        }, [offscreen]);

        document.addEventListener('click', () => this.audio.init(), { once: true });
    }

    async addSource() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true
            });

            const id = `src_${Date.now()}`;
            this.sources.set(id, { stream });

            await this.audio.connectStream(stream, id, (level) => {
                const vu = document.getElementById(`vu-${id}`);
                if (vu) vu.style.height = `${level * 100}%`;
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.setAttribute('playsinline', '');
            await video.play();

            // Pumping frames at 60fps
            const pump = async () => {
                if (video.readyState >= 2) {
                    const bitmap = await createImageBitmap(video);
                    this.worker.postMessage({ type: 'FRAME', payload: { id, bitmap } }, [bitmap]);
                }
                requestAnimationFrame(pump);
            };
            pump();
            
            this.createSourceUI(id);
            this.syncLayers();
        } catch (err) {
            alert("Permission Error: Check Chrome Settings");
        }
    }

    syncLayers() {
        const layers = Array.from(this.sources.keys()).map(id => ({ id }));
        this.worker.postMessage({ type: 'UPDATE_LAYERS', payload: layers });
    }

    createSourceUI(id) {
        const list = document.getElementById('source-list');
        if (!list) return;
        list.innerHTML = `<div style="padding:10px; border:1px solid #00d4ff; display:flex; gap:10px; align-items:center;">
            <div style="width:5px; height:30px; background:#111;"><div id="vu-${id}" style="width:100%; height:0%; background:cyan;"></div></div>
            <span style="font-size:10px;">CAM ACTIVE</span>
        </div>`;
    }
}

window.Studio = new OmniFluxTitan();
