/* This is a very basic sound generator.
   Could be replaced by something with sound samples.
*/

class AudioClass {
    constructor() {
        this.started = false;
        this.running = false;
    }

    start() {
        if (!this.started) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
            this.oscillator = null;
            this.started = true;
            this.priority = 0;

            if (this.audioCtx.state === "suspended") {
                this.audioCtx.resume().then(() => {
                    this.running = true;
                });
            } else {
                this.running = true;
            }
        }
    }

    playDing(pitch = 1, length = 1) {
        this.playGeneric(1, 0.1 * length, (osc, curTime) => {
            osc.type = "sine";
            osc.frequency.setValueAtTime(440 * pitch, curTime);
            osc.frequency.setValueAtTime(880 * pitch, curTime + 0.05 * length);
        });
    }

    playJump() {
        this.playGeneric(2, 0.05 * 20, (osc, curTime) => {
            osc.type = "sine";
            for (let i = 0; i < 20; i++) {
                osc.frequency.setValueAtTime(110 * (Math.sin(i / 20 * Math.PI) + 2), curTime + 0.05 * i);
            }
        });
    }

    playBad(pitch = 1, length = 1) {
        this.playGeneric(3, 0.1 * length, (osc, curTime) => {
            osc.type = "square";
            osc.frequency.setValueAtTime(880 * pitch, curTime);
            osc.frequency.setValueAtTime(440 * pitch, curTime + 0.05 * length);
        });
    }

    playLost() {
        this.playGeneric(4, 0.2 * 4, (osc, curTime) => {
            osc.type = "square";
            for (let i = 0; i < 4; i++) {
                osc.frequency.setValueAtTime(110 * (4 - i), curTime + 0.2 * i);
            }
        });
    }

    playWon() {
        this.playGeneric(4, 0.2 * 5, (osc, curTime) => {
            osc.type = "square";
            for (let i = 0; i < 4; i++) {
                osc.frequency.setValueAtTime(220 * (i + 2), curTime + 0.2 * i);
            }
        });
    }

    playGeneric(priority, length, fnSound) {
        if (!this.running || this.priority > priority) {
            return;
        }
        const audioCtx = this.audioCtx;
        const curTime = audioCtx.currentTime;

        if (this.oscillator) {
            this.oscillator.onended = null;
            this.oscillator.disconnect();
        }
        this.oscillator = audioCtx.createOscillator();
        fnSound(this.oscillator, curTime);
        const gain = audioCtx.createGain();
        this.oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        this.oscillator.start();
        // avoid click at end
        gain.gain.setTargetAtTime(0, curTime + length - 0.025, 0.005);
        this.oscillator.stop(curTime + length);
        this.priority = priority;
        this.oscillator.onended = () => {
            this.oscillator = null;
            this.priority = 0;
        };
    }
}

const Audio = new AudioClass;

export { Audio };