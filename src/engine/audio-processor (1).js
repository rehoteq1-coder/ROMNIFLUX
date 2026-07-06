/**
 * R.OMNIFLUX TITAN AUDIO PROCESSOR
 * Runs in the Real-Time Audio Thread (AudioWorklet).
 */
class TitanAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._lastUpdate = 0;
        this._peak = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]; 
        const output = outputs[0];

        if (input.length > 0) {
            const samples = input[0]; 
            let peak = 0;

            for (let i = 0; i < samples.length; i++) {
                // Pass-through
                if (output.length > 0) {
                    output[0][i] = samples[i];
                    if (output[1]) output[1][i] = samples[i];
                }

                // VU Meter Peak Detection
                const abs = Math.abs(samples[i]);
                if (abs > peak) peak = abs;
            }

            this._peak = peak;

            // Send level to UI thread every 16ms (60fps)
            const now = currentTime;
            if (now - this._lastUpdate > 0.016) {
                this.port.postMessage({ type: 'VU', level: this._peak });
                this._lastUpdate = now;
            }
        }
        return true;
    }
}

registerProcessor('titan-audio-processor', TitanAudioProcessor);
