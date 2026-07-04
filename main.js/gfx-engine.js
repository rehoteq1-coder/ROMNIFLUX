/**
 * R.OMNIFLUX GFX ENGINE
 * Renders Pro-Grade Text/Bible/Hymns to GPU Textures
 */

class OmniFluxGFX {
    constructor(studio) {
        this.studio = studio;
        this.canvas = new OffscreenCanvas(1920, 1080);
        this.ctx = this.canvas.getContext('2d');
    }

    renderSlide(text, subtext = "") {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, 1920, 1080);

        // 1. Shadow/Glow for Readability
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        // 2. Main Text (Hymn/Verse)
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "bold 60px 'Rajdhani'";
        
        // Simple text wrapping
        const words = text.split(' ');
        let line = '';
        let y = 850; // Bottom-third position
        
        for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            if (ctx.measureText(testLine).width > 1600) {
                ctx.fillText(line, 960, y);
                line = words[n] + ' ';
                y += 70;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 960, y);

        // 3. Subtext (Bible Reference / Hymn Title)
        if (subtext) {
            ctx.font = "italic 30px 'Rajdhani'";
            ctx.fillStyle = "rgba(0, 212, 255, 1)";
            ctx.fillText(subtext, 960, y + 60);
        }

        this.updateGPU();
    }

    async updateGPU() {
        const bitmap = this.canvas.transferToImageBitmap();
        this.studio.worker.postMessage({
            type: 'SET_OVERLAY',
            payload: { bitmap }
        }, [bitmap]);
    }

    clear() {
        this.ctx.clearRect(0, 0, 1920, 1080);
        this.updateGPU();
    }
}

export default OmniFluxGFX;
