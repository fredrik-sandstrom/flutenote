class Tuner {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.stream = null; // Store stream to stop it later
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
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferLength * 2;

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
        // Implements the autocorrelation algorithm for pitch detection
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

        // Calculate the autocorrelation for each offset
        // Start from a minimum offset to avoid detecting impossibly high frequencies
        // For a max frequency of ~4000 Hz at 48000 sample rate, min offset = 48000/4000 = 12
        let minOffset = Math.floor(sampleRate / 4000); // Start at ~4000 Hz max

        for (let offset = minOffset; offset < maxSamples; offset++) {
            let correlation = 0;

            // Calculate autocorrelation: sum of products (NOT differences!)
            for (let i = 0; i < maxSamples; i++) {
                correlation += buffer[i] * buffer[i + offset];
            }

            // Normalize correlation
            correlation = correlation / maxSamples;

            // Track the best correlation
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
        }

        // Check if we found a strong enough correlation
        // Lower threshold to 0.01 * rms to be more sensitive
        if (bestCorrelation > 0.01 && bestOffset !== -1) {
            // Refine the offset using parabolic interpolation
            // This gives us sub-sample accuracy
            if (bestOffset > minOffset && bestOffset < maxSamples - 1) {
                // Get correlation values around the peak
                let y1 = 0, y2 = bestCorrelation, y3 = 0;

                // Calculate correlation for offset-1
                for (let i = 0; i < maxSamples; i++) {
                    y1 += buffer[i] * buffer[i + bestOffset - 1];
                }
                y1 = y1 / maxSamples;

                // Calculate correlation for offset+1
                for (let i = 0; i < maxSamples; i++) {
                    y3 += buffer[i] * buffer[i + bestOffset + 1];
                }
                y3 = y3 / maxSamples;

                // Parabolic interpolation formula
                let shift = (y1 - y3) / (2 * (2 * y2 - y1 - y3));

                // Avoid invalid shifts
                if (isFinite(shift) && Math.abs(shift) < 1) {
                    return sampleRate / (bestOffset + shift);
                }
            }

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
