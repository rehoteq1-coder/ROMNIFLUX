/**
 * R.OMNIFLUX PRO AUDIO PROCESSOR
 * Runs in the Real-Time Audio Thread.
 */

class OmniFluxAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._lastUpdate = 0;
        this._peak = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]; // Channel 1 (Microphone/Source)
        const output = outputs[0];

        if (input.length > 0) {
            const samples = input[0]; // Mono/Left channel
            let peak = 0;

            for (let i = 0; i < samples.length; i++) {
                // 1. Pass-through audio to output
                output[0][i] = samples[i];
                if (output[1]) output[1][i] = samples[i]; // Stereo mirror

                // 2. Calculate Peak for VU Meters
                const abs = Math.abs(samples[i]);
                if (abs > peak) peak = abs;
            }

            this._peak = peak;

            // 3. Throttle VU updates to UI (every 16ms / 60fps)
            const now = currentTime;
            if (now - this._lastUpdate > 0.016) {
                this.port.postMessage({ type: 'VU_LEVEL', level: this._peak });
                this._lastUpdate = now;
            }
        }

        return true; // Keep processor alive
    }
}

registerProcessor('omniflux-pro-audio', OmniFluxAudioProcessor);
