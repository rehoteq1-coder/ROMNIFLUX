import TitanAudioMixer from './engine/audio-mixer.js';

class OmniFluxTitan {
    constructor() {
        this.worker = new Worker('src/engine/compositor.js');
        this.audio = new TitanAudioMixer();
        this.sources = new Map();
    }

    async init(canvas) {
        // Set physical size before transfer
        canvas.width = 1280;
        canvas.height = 720;
        
        const offscreen = canvas.transferControlToOffscreen();
        this.worker.postMessage({ type: 'INIT', payload: { canvas: offscreen } }, [offscreen]);

        document.addEventListener('click', () => this.audio.init(), { once: true });
        console.log("Titan Engine Initialized");
    }

    async addSource() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true
            });

            const id = `src_${Date.now()}`;
            this.sources.set(id, { stream });

            // 1. Audio Connection
            await this.audio.connectStream(stream, id, (level) => {
                const vu = document.getElementById(`vu-${id}`);
                if (vu) vu.style.height = `${level * 100}%`;
            });

            // 2. Universal Video Pipeline (The Stability King)
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.setAttribute('playsinline', '');
            await video.play();

            const pushFrame = async () => {
                if (video.readyState >= 2) {
                    const bitmap = await createImageBitmap(video);
                    this.worker.postMessage({ type: 'FRAME', payload: { id, bitmap } }, [bitmap]);
                }
                requestAnimationFrame(pushFrame);
            };
            pushFrame();
            
            this.createSourceUI(id);
            this.syncLayers();

        } catch (err) {
            alert("Camera Blocked. Check Chrome Permissions.");
        }
    }

    syncLayers() {
        const layers = Array.from(this.sources.keys()).map(id => ({ id }));
        this.worker.postMessage({ type: 'UPDATE_LAYERS', payload: layers });
    }

    createSourceUI(id) {
        const list = document.getElementById('source-list');
        if (!list) return;
        const div = document.createElement('div');
        div.style.cssText = 'padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; gap:10px; align-items:center;';
        div.innerHTML = `
            <div style="width:5px; height:30px; background:#111; border-radius:2px; overflow:hidden;">
                <div id="vu-${id}" style="width:100%; height:0%; background:cyan; transition:height 0.1s;"></div>
            </div>
            <div style="font-size:11px; font-weight:bold;">CAMERA</div>
        `;
        list.appendChild(div);
    }
}

window.Studio = new OmniFluxTitan();
