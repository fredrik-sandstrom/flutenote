// Initialize tuner and metronome
const tuner = new Tuner();
const metronome = new Metronome();

// DOM elements - Tuner
const startTunerBtn = document.getElementById('startTuner');
const stopTunerBtn = document.getElementById('stopTuner');
const noteText = document.getElementById('noteText');
const frequency = document.getElementById('frequency');
const meterNeedle = document.getElementById('meterNeedle');
const centsDisplay = document.getElementById('centsDisplay');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// DOM elements - Metronome
const startMetronomeBtn = document.getElementById('startMetronome');
const stopMetronomeBtn = document.getElementById('stopMetronome');
const tempoSlider = document.getElementById('tempoSlider');
const tempoDisplay = document.getElementById('tempoDisplay');
const beatsPerMeasure = document.getElementById('beatsPerMeasure');
const beatIndicator = document.getElementById('beatIndicator');

// Tuner event handlers
startTunerBtn.addEventListener('click', async () => {
    const started = await tuner.start();
    if (started) {
        startTunerBtn.style.display = 'none';
        stopTunerBtn.style.display = 'inline-block';
        statusDot.className = 'status-dot active';
        statusText.textContent = 'Listening...';
    }
});

stopTunerBtn.addEventListener('click', () => {
    tuner.stop();
    startTunerBtn.style.display = 'inline-block';
    stopTunerBtn.style.display = 'none';
    statusDot.className = 'status-dot';
    statusText.textContent = 'Tuner stopped';
    noteText.textContent = '--';
    frequency.textContent = '0 Hz';
    centsDisplay.textContent = '0 cents';
    meterNeedle.style.left = '50%';
});

// Override tuner's onPitchDetected method
tuner.onPitchDetected = (freq, note) => {
    if (note) {
        noteText.textContent = note.fullName;
        frequency.textContent = `${Math.round(freq)} Hz`;
        centsDisplay.textContent = `${note.cents > 0 ? '+' : ''}${note.cents} cents`;

        // Update meter needle position (-50 to +50 cents)
        const needlePosition = 50 + (note.cents / 50) * 50; // Map -50/+50 cents to 0-100%
        const clampedPosition = Math.max(0, Math.min(100, needlePosition));
        meterNeedle.style.left = `${clampedPosition}%`;

        // Update needle color based on tuning accuracy
        if (Math.abs(note.cents) <= 5) {
            meterNeedle.style.backgroundColor = '#4CAF50'; // Green - in tune
        } else if (Math.abs(note.cents) <= 15) {
            meterNeedle.style.backgroundColor = '#FFC107'; // Yellow - close
        } else {
            meterNeedle.style.backgroundColor = '#f44336'; // Red - out of tune
        }
    } else {
        noteText.textContent = '--';
        frequency.textContent = '0 Hz';
        centsDisplay.textContent = '0 cents';
        meterNeedle.style.left = '50%';
        meterNeedle.style.backgroundColor = '#666';
    }
};

// Metronome event handlers
startMetronomeBtn.addEventListener('click', () => {
    metronome.start();
    startMetronomeBtn.style.display = 'none';
    stopMetronomeBtn.style.display = 'inline-block';
    updateBeatIndicator();
});

stopMetronomeBtn.addEventListener('click', () => {
    metronome.stop();
    startMetronomeBtn.style.display = 'inline-block';
    stopMetronomeBtn.style.display = 'none';
    updateBeatIndicator();
});

tempoSlider.addEventListener('input', (e) => {
    const tempo = parseInt(e.target.value);
    metronome.setTempo(tempo);
    tempoDisplay.textContent = tempo;
});

beatsPerMeasure.addEventListener('change', (e) => {
    const beats = parseInt(e.target.value);
    metronome.setBeatsPerMeasure(beats);
    updateBeatIndicator();
});

// Override metronome's onBeat method
metronome.onBeat = (beatNumber, time) => {
    // Schedule visual update slightly before the audio
    const visualDelay = (time - metronome.audioContext.currentTime) * 1000;

    setTimeout(() => {
        updateBeatIndicator(beatNumber);
    }, Math.max(0, visualDelay));
};

function updateBeatIndicator(activeBeat = -1) {
    const beats = parseInt(beatsPerMeasure.value);
    const dotsContainer = beatIndicator.querySelector('.beat-dots');

    // Clear existing dots
    dotsContainer.innerHTML = '';

    // Create beat dots
    for (let i = 0; i < beats; i++) {
        const dot = document.createElement('div');
        dot.className = 'beat-dot';

        if (i === 0) {
            dot.classList.add('accent');
        }

        if (i === activeBeat) {
            dot.classList.add('active');
        }

        dotsContainer.appendChild(dot);
    }
}

// Initialize beat indicator
updateBeatIndicator();
