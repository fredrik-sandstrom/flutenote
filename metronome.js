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

    start() {
        if (this.isRunning) return;

        // Create audio context if it doesn't exist
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        this.isRunning = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.audioContext.currentTime;
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

    onBeat(beatNumber, time) {
        // This will be overridden by the app
    }
}
