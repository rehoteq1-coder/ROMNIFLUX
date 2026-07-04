/**
 * R.OMNIFLUX AUDIO MIXER
 * Manages nodes and worklet lifecycle
 */

class OmniFluxAudioMixer {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.nodes = new Map();
    }

    async init() {
        this.context = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000, // Pro Standard
        });

        // Load the Worklet Engine
        await this.context.audioWorklet.addModule('src/engine/audio-processor.js');

        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.context.destination);

        console.log("OmniFlux Audio Engine Ready (48kHz)");
    }

    async connectSource(stream, sourceId, onLevelUpdate) {
        if (!this.context) await this.init();
        if (this.context.state === 'suspended') await this.context.resume();

        const source = this.context.createMediaStreamSource(stream);
        
        // Create the high-performance worklet node
        const workletNode = new AudioWorkletNode(this.context, 'omniflux-pro-audio');
        
        // Handle VU Meter data coming back from the audio thread
        workletNode.port.onmessage = (e) => {
            if (e.data.type === 'VU_LEVEL') {
                onLevelUpdate(e.data.level);
            }
        };

        source.connect(workletNode);
        workletNode.connect(this.masterGain);

        this.nodes.set(sourceId, { source, workletNode });
    }
}

export default OmniFluxAudioMixer;
