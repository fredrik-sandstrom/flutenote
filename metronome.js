class Metronome {
    constructor() {
        this.audioContext = null;
        this.tempo = 120; // BPM
        this.beatsPerMeasure = 4;
        this.currentBeat = 0;
        this.isRunning = false;
        this.nextNoteTime = 0;
        this.scheduleAheadTime = 0.1; // How far ahead to schedule (in seconds)
        this.timerID = null;
    }

    start(startPhase = 0) {
        if (this.isRunning) return;

        // Create audio context if it doesn't exist
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        this.isRunning = true;

        // Calculate beat timing based on start phase (0.0 to 1.0)
        const secondsPerBeat = 60.0 / this.tempo;
        const offsetTime = startPhase * secondsPerBeat;

        // Set current beat based on phase
        this.currentBeat = Math.floor(startPhase * this.beatsPerMeasure);

        // Schedule next note with phase offset
        this.nextNoteTime = this.audioContext.currentTime + (secondsPerBeat - offsetTime);

        this.scheduler();
    }

    stop() {
        this.isRunning = false;
        if (this.timerID) {
            clearTimeout(this.timerID);
        }
        this.currentBeat = 0;
    }

    scheduler() {
        // Schedule notes ahead of time
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            this.nextNote();
        }

        if (this.isRunning) {
            this.timerID = setTimeout(() => this.scheduler(), 25);
        }
    }

    nextNote() {
        // Calculate the time for the next beat
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += secondsPerBeat;

        // Advance the beat
        this.currentBeat++;
        if (this.currentBeat >= this.beatsPerMeasure) {
            this.currentBeat = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        // Create oscillator for the click sound
        const osc = this.audioContext.createOscillator();
        const envelope = this.audioContext.createGain();
        const masterGain = this.audioContext.createGain();

        // First beat is accented (higher pitch and louder)
        osc.frequency.value = beatNumber === 0 ? 1200 : 800;

        // Louder volume - start at max and decay more slowly
        envelope.gain.value = 1;
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        // Master gain boost for overall louder output
        masterGain.gain.value = 0.95;

        osc.connect(envelope);
        envelope.connect(masterGain);
        masterGain.connect(this.audioContext.destination);

        osc.start(time);
        osc.stop(time + 0.1);

        // Trigger visual update
        this.onBeat(beatNumber, time);
    }

    setTempo(tempo) {
        this.tempo = Math.max(40, Math.min(208, tempo));
    }

    setBeatsPerMeasure(beats) {
        this.beatsPerMeasure = beats;
        if (this.currentBeat >= this.beatsPerMeasure) {
            this.currentBeat = 0;
        }
    }

    getBeatPhase() {
        // Returns the current beat phase as a value between 0.0 and 1.0
        // 0.0 = start of beat, 1.0 = end of beat (about to start next beat)
        if (!this.isRunning || !this.audioContext) {
            return 0;
        }

        const secondsPerBeat = 60.0 / this.tempo;
        const timeSinceLastBeat = this.audioContext.currentTime - (this.nextNoteTime - secondsPerBeat);
        const phase = (timeSinceLastBeat / secondsPerBeat) % 1.0;

        return phase < 0 ? 0 : phase;
    }

    onBeat(beatNumber, time) {
        // This will be overridden by the app
    }
}
