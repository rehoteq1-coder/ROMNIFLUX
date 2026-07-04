/**
 * R.OMNIFLUX STREAMING ENGINE
 * Manages RTMP Destinations and Bitrate
 */

class OmniFluxStreamer {
    constructor(studio) {
        this.studio = studio;
        this.isLive = false;
        this.config = {
            url: "",
            key: "",
            bitrate: 6000000 // 6Mbps for 1080p
        };
    }

    setDestination(url, key) {
        this.config.url = url;
        this.config.key = key;
    }

    async startStream() {
        if (!this.config.url || !this.config.key) {
            alert("Please set RTMP URL and Stream Key first.");
            return;
        }

        this.isLive = true;
        console.log(`Streaming to ${this.config.url} at ${this.config.bitrate/1000}kbps`);
        
        // This is where we hook into the WebCodecs encoder we built for the recorder
        // and send the chunks to a WebSocket relay instead of a file.
        this.studio.startBroadcast(this.config);
    }

    stopStream() {
        this.isLive = false;
        this.studio.stopBroadcast();
    }
}

export default OmniFluxStreamer;
