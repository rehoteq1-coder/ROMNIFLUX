/**
 * R.OMNIFLUX TITAN AUDIO MIXER
 * Manages the high-fidelity audio graph.
 */
class TitanAudioMixer {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.sources = new Map();
    }

    async init() {
        if (this.context) return;
        
        this.context = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000,
        });

        // Load the Pro Worklet
        await this.context.audioWorklet.addModule('src/engine/audio-processor.js');

        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.context.destination);
        
        console.log("Titan Audio Engine: ONLINE (48kHz)");
    }

    async connectStream(stream, sourceId, onLevel) {
        if (!this.context) await this.init();
        if (this.context.state === 'suspended') await this.context.resume();

        const sourceNode = this.context.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(this.context, 'titan-audio-processor');
        
        workletNode.port.onmessage = (e) => {
            if (e.data.type === 'VU') onLevel(e.data.level);
        };

        sourceNode.connect(workletNode);
        workletNode.connect(this.masterGain);

        this.sources.set(sourceId, { sourceNode, workletNode });
    }

    setMasterVolume(val) {
        if (this.masterGain) this.masterGain.gain.setTargetAtTime(val, this.context.currentTime, 0.05);
    }
}

export default TitanAudioMixer;
