/**
 * R.OMNIFLUX GUEST MANAGER
 * Handles WebRTC Multi-Guest Peer Connections
 */

class GuestManager {
    constructor(studio) {
        this.studio = studio;
        this.peers = new Map();
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }

    async createGuestSlot(guestId) {
        const pc = new RTCPeerConnection(this.config);
        
        pc.ontrack = (event) => {
            console.log(`Incoming stream from guest: ${guestId}`);
            this.studio.registerGuestStream(guestId, event.streams[0]);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // In a real app, send this to Firebase/Signaling Server
                console.log("New ICE Candidate", event.candidate);
            }
        };

        this.peers.set(guestId, pc);
        return pc;
    }

    // This would be triggered by a "Join" link
    async handleOffer(guestId, offer) {
        const pc = await this.createGuestSlot(guestId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        return answer;
    }
}

export default GuestManager;
