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
        let rms = 0;

        // Calculate RMS (root mean square) to detect if there's enough signal
        for (let i = 0; i < size; i++) {
            let val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / size);

        // Not enough signal
        if (rms < 0.01) return -1;

        // Calculate zero-lag autocorrelation (for normalization)
        let r0 = 0;
        for (let i = 0; i < maxSamples; i++) {
            r0 += buffer[i] * buffer[i];
        }

        // Find the first peak in the autocorrelation function
        // Start from a minimum offset to avoid detecting impossibly high frequencies
        let minOffset = Math.floor(sampleRate / 4000); // ~4000 Hz max
        let maxOffset = Math.floor(sampleRate / 80);   // ~80 Hz min (below lowest flute note)

        // Store correlation values
        let correlations = new Float32Array(maxOffset - minOffset + 1);

        for (let offset = minOffset; offset <= maxOffset; offset++) {
            let correlation = 0;

            // Calculate autocorrelation at this offset
            for (let i = 0; i < maxSamples; i++) {
                correlation += buffer[i] * buffer[i + offset];
            }

            // Normalize by zero-lag autocorrelation
            correlations[offset - minOffset] = correlation / r0;
        }

        // Find the first peak that crosses our threshold
        // A peak is where correlation goes up then down, and exceeds threshold
        let threshold = 0.5; // Require 50% correlation
        let foundPeak = false;
        let peakOffset = -1;
        let peakValue = -1;

        for (let i = 1; i < correlations.length - 1; i++) {
            let offset = minOffset + i;

            // Check if this is a local maximum
            if (correlations[i] > correlations[i - 1] &&
                correlations[i] >= correlations[i + 1] &&
                correlations[i] > threshold) {

                peakOffset = offset;
                peakValue = correlations[i];
                foundPeak = true;
                break; // Take the FIRST good peak (fundamental frequency)
            }
        }

        if (!foundPeak) {
            return -1;
        }

        // Refine the peak using parabolic interpolation for sub-sample accuracy
        let shift = 0;
        if (peakOffset > minOffset && peakOffset < maxOffset) {
            let y1 = correlations[peakOffset - minOffset - 1];
            let y2 = correlations[peakOffset - minOffset];
            let y3 = correlations[peakOffset - minOffset + 1];

            // Parabolic interpolation formula
            let denominator = 2 * (2 * y2 - y1 - y3);
            if (denominator !== 0) {
                shift = (y1 - y3) / denominator;

                // Clamp shift to reasonable range
                if (!isFinite(shift) || Math.abs(shift) > 1) {
                    shift = 0;
                }
            }
        }

        return sampleRate / (peakOffset + shift);
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
