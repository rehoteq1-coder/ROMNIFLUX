/**
 * R.OMNIFLUX PRO RECORDER
 * Hardware-accelerated WebCodecs Encoder
 */

class OmniFluxRecorder {
    constructor(stream) {
        this.stream = stream;
        this.writer = null;
        this.encoder = null;
        this.framesEncoded = 0;
    }

    async start() {
        // 1. File System Access API (Save directly to disk)
        const handle = await window.showSaveFilePicker({
            suggestedName: `omniflux-record-${Date.now()}.mp4`,
            types: [{ description: 'Video File', accept: { 'video/mp4': ['.mp4'] } }]
        });
        this.writer = await handle.createWritable();

        // 2. Configure Hardware Encoder
        this.encoder = new VideoEncoder({
            output: (chunk) => this.handleChunk(chunk),
            error: (e) => console.error(e)
        });

        this.encoder.configure({
            codec: 'avc1.42E01F', // H.264 Baseline
            width: 1920,
            height: 1080,
            bitrate: 12_000_000, // 12 Mbps (High Pro Quality)
            framerate: 60,
            hardwareAcceleration: 'prefer-hardware'
        });

        console.log("Pro Recorder Started @ 12Mbps");
    }

    handleChunk(chunk) {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.writer.write(data);
    }

    async stop() {
        await this.encoder.flush();
        await this.writer.close();
        console.log("Recording Saved Successfully.");
    }
}

export default OmniFluxRecorder;
