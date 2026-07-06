class OmniFluxStudio {
    constructor() {
        this.worker = new Worker('src/engine/compositor.js');
        this.sources = new Map();
    }

    async init(canvas) {
        const offscreen = canvas.transferControlToOffscreen();
        this.worker.postMessage({ type: 'INIT', payload: { canvas: offscreen } }, [offscreen]);
    }

    async addSource() {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1920, height: 1080, frameRate: 60 } 
        });
        const id = `cam_${Date.now()}`;
        
        // The Pro Way: Extract the Video Track
        const track = stream.getVideoTracks()[0];
        const processor = new MediaStreamTrackProcessor(track);
        const reader = processor.readable.getReader();

        this.sources.set(id, { stream, reader });
        this.readFrames(id, reader);
        this.updateWorkerLayers();
    }

    async readFrames(id, reader) {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Transfer the frame to the GPU Worker
            const bitmap = await createImageBitmap(value);
            this.worker.postMessage({ 
                type: 'FRAME', 
                payload: { id, bitmap } 
            }, [bitmap]);
            
            value.close(); // Immediate memory cleanup
        }
    }

    updateWorkerLayers() {
        const layers = Array.from(this.sources.keys()).map(id => ({ id }));
        this.worker.postMessage({ type: 'UPDATE_LAYERS', payload: layers });
    }
}

window.Studio = new OmniFluxStudio();
