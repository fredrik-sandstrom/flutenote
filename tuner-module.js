// Import Pitchy from CDN
import { PitchDetector } from 'https://cdn.skypack.dev/pitchy@4.0.5';

export class Tuner {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.stream = null;
        this.bufferLength = 2048;
        this.buffer = new Float32Array(this.bufferLength);
        this.isRunning = false;
        this.animationId = null;
        this.pitchDetector = null;

        // Musical notes and their frequencies (A4 = 440 Hz)
        this.noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    }

    async start() {
        try {
            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferLength * 2;

            // Initialize Pitchy detector
            this.pitchDetector = PitchDetector.forFloat32Array(this.analyser.fftSize);

            // Connect microphone to analyser
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            this.microphone.connect(this.analyser);

            this.isRunning = true;
            this.updatePitch();

            return true;
        } catch (error) {
            console.error('Error starting tuner:', error);
            alert('Could not access microphone. Please grant permission and try again.');
            return false;
        }
    }

    stop() {
        this.isRunning = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.microphone) {
            this.microphone.disconnect();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    updatePitch() {
        if (!this.isRunning) return;

        // Get time domain data
        this.analyser.getFloatTimeDomainData(this.buffer);

        // Detect pitch using Pitchy (YIN algorithm)
        const [pitch, clarity] = this.pitchDetector.findPitch(this.buffer, this.audioContext.sampleRate);

        // Pitchy returns pitch and clarity (confidence)
        // Clarity is between 0 and 1, higher is better
        // Adjusted threshold to 0.9 for higher confidence
        if (pitch && clarity > 0.9) {
            const note = this.frequencyToNote(pitch);
            this.onPitchDetected(pitch, note);
        } else {
            this.onPitchDetected(null, null);
        }

        this.animationId = requestAnimationFrame(() => this.updatePitch());
    }

    frequencyToNote(frequency) {
        // Convert frequency to note name and cents offset
        const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        const noteIndex = Math.round(noteNum) + 69; // MIDI note number (A4 = 69)
        const cents = Math.floor((noteNum - Math.round(noteNum)) * 100);

        const octave = Math.floor(noteIndex / 12) - 1;
        const noteName = this.noteStrings[noteIndex % 12];

        return {
            name: noteName,
            octave: octave,
            frequency: frequency,
            cents: cents,
            fullName: `${noteName}${octave}`
        };
    }

    onPitchDetected(frequency, note) {
        // This will be overridden by the app
    }
}
