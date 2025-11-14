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
        // YIN algorithm for pitch detection (more accurate than simple autocorrelation)
        // Reference: https://github.com/ianprime0509/pitchy
        const threshold = 0.1;
        const probabilityThreshold = 0.1;
        const bufferSize = buffer.length;

        // Step 1: Calculate the difference function
        const yinBuffer = new Float32Array(bufferSize / 2);
        yinBuffer[0] = 1.0;

        let runningSum = 0;
        for (let tau = 1; tau < yinBuffer.length; tau++) {
            let sum = 0;
            for (let i = 0; i < yinBuffer.length; i++) {
                const delta = buffer[i] - buffer[i + tau];
                sum += delta * delta;
            }
            yinBuffer[tau] = sum;
        }

        // Step 2: Calculate the cumulative mean normalized difference function
        for (let tau = 1; tau < yinBuffer.length; tau++) {
            runningSum += yinBuffer[tau];
            if (runningSum === 0) {
                yinBuffer[tau] = 1;
            } else {
                yinBuffer[tau] *= tau / runningSum;
            }
        }

        // Step 3: Find the first tau where the CMNDF drops below threshold
        let tauEstimate = -1;
        let minTau = Math.floor(sampleRate / 1000); // Min 1000 Hz
        let maxTau = Math.floor(sampleRate / 80);   // Max 80 Hz

        for (let tau = minTau; tau < maxTau; tau++) {
            if (yinBuffer[tau] < threshold) {
                // Find local minimum
                while (tau + 1 < maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }

        // If no good estimate found, find the global minimum
        if (tauEstimate === -1) {
            let minVal = 1.0;
            for (let tau = minTau; tau < maxTau; tau++) {
                if (yinBuffer[tau] < minVal) {
                    minVal = yinBuffer[tau];
                    tauEstimate = tau;
                }
            }

            // If minimum is still too high, no pitch detected
            if (minVal > probabilityThreshold) {
                return -1;
            }
        }

        // Step 4: Parabolic interpolation for better accuracy
        let betterTau = tauEstimate;
        if (tauEstimate > 0 && tauEstimate < yinBuffer.length - 1) {
            const x0 = tauEstimate - 1;
            const x2 = tauEstimate + 1;
            const y0 = yinBuffer[x0];
            const y1 = yinBuffer[tauEstimate];
            const y2 = yinBuffer[x2];

            const denominator = 2 * (2 * y1 - y0 - y2);
            if (denominator !== 0) {
                const delta = (y0 - y2) / denominator;
                betterTau = tauEstimate + delta;
            }
        }

        // Convert tau to frequency
        return sampleRate / betterTau;
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
