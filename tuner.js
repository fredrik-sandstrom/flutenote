class Tuner {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.bufferLength = 2048;
        this.buffer = new Float32Array(this.bufferLength);
        this.isRunning = false;
        this.animationId = null;

        // Musical notes and their frequencies (A4 = 440 Hz)
        this.noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    }

    async start() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferLength * 2;

            // Connect microphone to analyser
            this.microphone = this.audioContext.createMediaStreamSource(stream);
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
            this.microphone.mediaStream.getTracks().forEach(track => track.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    updatePitch() {
        if (!this.isRunning) return;

        // Get time domain data
        this.analyser.getFloatTimeDomainData(this.buffer);

        // Detect pitch using autocorrelation
        const pitch = this.autoCorrelate(this.buffer, this.audioContext.sampleRate);

        if (pitch && pitch !== -1) {
            const note = this.frequencyToNote(pitch);
            this.onPitchDetected(pitch, note);
        } else {
            this.onPitchDetected(null, null);
        }

        this.animationId = requestAnimationFrame(() => this.updatePitch());
    }

    autoCorrelate(buffer, sampleRate) {
        // Implements autocorrelation algorithm for pitch detection
        let size = buffer.length;
        let maxSamples = Math.floor(size / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let rms = 0;

        // Calculate RMS (root mean square) to detect if there's enough signal
        for (let i = 0; i < size; i++) {
            let val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / size);

        // Not enough signal
        if (rms < 0.01) return -1;

        // Find the best correlation offset
        let lastCorrelation = 1;
        for (let offset = 0; offset < maxSamples; offset++) {
            let correlation = 0;

            for (let i = 0; i < maxSamples; i++) {
                correlation += Math.abs(buffer[i] - buffer[i + offset]);
            }

            correlation = 1 - (correlation / maxSamples);

            if (correlation > 0.9 && correlation > lastCorrelation) {
                let foundGoodCorrelation = false;

                // Check if we found a good correlation
                if (correlation > bestCorrelation) {
                    bestCorrelation = correlation;
                    bestOffset = offset;
                    foundGoodCorrelation = true;
                }

                if (foundGoodCorrelation) {
                    // Refine offset using parabolic interpolation
                    let shift = 0;
                    if (offset > 0 && offset < maxSamples - 1) {
                        let y1 = lastCorrelation;
                        let y2 = correlation;

                        shift = (y1 - correlation) / (2 * (2 * correlation - y1 - correlation));
                    }
                    return sampleRate / (bestOffset + shift);
                }
            }

            lastCorrelation = correlation;
        }

        if (bestCorrelation > 0.01) {
            return sampleRate / bestOffset;
        }

        return -1;
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
