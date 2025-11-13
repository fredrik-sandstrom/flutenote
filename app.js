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

// DOM elements - Transcript (Piano Roll)
const transcriptDisplay = document.getElementById('transcriptDisplay');
const clearTranscriptBtn = document.getElementById('clearTranscript');
const pianoRollCanvas = document.getElementById('pianoRollCanvas');
const noteLabels = document.getElementById('noteLabels');
const scrollContainer = document.getElementById('scrollContainer');

// DOM elements - Song playback
const songInput = document.getElementById('songInput');
const playSongBtn = document.getElementById('playSong');
const stopSongBtn = document.getElementById('stopSong');
const loadExampleBtn = document.getElementById('loadExample');
const transposeUpBtn = document.getElementById('transposeUp');
const transposeDownBtn = document.getElementById('transposeDown');

// DOM elements - Metronome
const startMetronomeBtn = document.getElementById('startMetronome');
const stopMetronomeBtn = document.getElementById('stopMetronome');
const tempoSlider = document.getElementById('tempoSlider');
const tempoDisplay = document.getElementById('tempoDisplay');
const beatsPerMeasure = document.getElementById('beatsPerMeasure');
const beatIndicator = document.getElementById('beatIndicator');

// Piano Roll tracking
let currentNote = null;
let noteStartTime = null;
const noteBars = []; // Array of {note, startTime, endTime, cents, yPosition, color}
const PIXELS_PER_SECOND = 100; // Scroll speed
const NOTE_HEIGHT = 20; // Height of each note lane

// Flute range: C4 (MIDI 60) to C7 (MIDI 96)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_MIDI = 60; // C4
const MAX_MIDI = 96; // C7
const TOTAL_NOTES = MAX_MIDI - MIN_MIDI + 1;

// Canvas context
let ctx = null;
let animationFrameId = null;
let startTime = null;

// Song playback
let songNotes = []; // Array of {note, startTime, endTime, yPosition, midi}
let songPlaying = false;
let songStartTime = null;
let songOriginalTempo = 120; // Store original song tempo for speed control

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

    // Finalize any current note when stopping
    finalizeCurrentNote();
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

        // Track note for transcript
        trackNote(note);
    } else {
        noteText.textContent = '--';
        frequency.textContent = '0 Hz';
        centsDisplay.textContent = '0 cents';
        meterNeedle.style.left = '50%';
        meterNeedle.style.backgroundColor = '#666';

        // Note stopped, finalize current note
        finalizeCurrentNote();
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

// Piano Roll Initialization
function initPianoRoll() {
    // Setup canvas
    ctx = pianoRollCanvas.getContext('2d');
    resizeCanvas();

    // Create note labels (from bottom to top to match canvas)
    for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
        const noteIndex = midi % 12;
        const noteName = NOTE_NAMES[noteIndex];
        const octave = Math.floor(midi / 12) - 1;
        const fullName = noteName + octave;

        const label = document.createElement('div');
        label.className = 'note-label';
        if (noteName.includes('#')) {
            label.classList.add('black-key');
        }
        label.textContent = fullName;
        noteLabels.appendChild(label);
    }

    // Start animation
    startTime = performance.now();
    animate();
}

function resizeCanvas() {
    const rect = scrollContainer.getBoundingClientRect();
    pianoRollCanvas.width = rect.width;
    pianoRollCanvas.height = TOTAL_NOTES * NOTE_HEIGHT;
}

// Helper: Convert note name to MIDI number
function noteNameToMidi(noteName) {
    // Parse note name like "C4", "C#4", "D5"
    const match = noteName.match(/^([A-G]#?)(\d+)$/);
    if (!match) return null;

    const [, note, octave] = match;
    const noteIndex = NOTE_NAMES.indexOf(note);
    if (noteIndex === -1) return null;

    return (parseInt(octave) + 1) * 12 + noteIndex;
}

// Helper: Get Y position for MIDI note
function getYPosition(midi) {
    return (MAX_MIDI - midi) * NOTE_HEIGHT;
}

// Helper: Get color based on accuracy
function getAccuracyColor(cents) {
    if (Math.abs(cents) <= 10) {
        return '#4CAF50'; // Green - perfect
    } else if (Math.abs(cents) <= 25) {
        return '#FFC107'; // Yellow - close
    } else {
        return '#f44336'; // Red - off
    }
}

// Animation loop
function animate() {
    const currentTime = performance.now();
    const elapsedSeconds = (currentTime - startTime) / 1000;

    // Clear canvas
    ctx.clearRect(0, 0, pianoRollCanvas.width, pianoRollCanvas.height);

    // Draw horizontal lines for each note
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= TOTAL_NOTES; i++) {
        const y = i * NOTE_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(pianoRollCanvas.width, y);
        ctx.stroke();
    }

    // Draw vertical "now" line (where notes should be when played)
    const nowX = pianoRollCanvas.width * 0.5; // 50% from left (middle)
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nowX, 0);
    ctx.lineTo(nowX, pianoRollCanvas.height);
    ctx.stroke();

    // Draw song notes (beneath player notes)
    if (songPlaying && songNotes.length > 0) {
        // Apply tempo scaling based on current metronome tempo
        const tempoScale = parseInt(tempoSlider.value) / songOriginalTempo;
        const songElapsed = (elapsedSeconds - songStartTime) * tempoScale;

        for (const songNote of songNotes) {
            const barStartX = nowX + (songNote.startTime - songElapsed) * PIXELS_PER_SECOND;
            const barEndX = nowX + (songNote.endTime - songElapsed) * PIXELS_PER_SECOND;
            const barWidth = barEndX - barStartX;

            // Only draw notes that are visible
            if (barEndX > 0 && barStartX < pianoRollCanvas.width) {
                // Determine if note has passed the blue line (mute color)
                const hasPassed = barEndX < nowX;

                // Draw song note as outlined bar (below player note position)
                const yOffset = 10; // Offset down from the note lane
                const noteHeight = NOTE_HEIGHT - 4;

                if (hasPassed) {
                    // Muted color for passed notes
                    ctx.fillStyle = 'rgba(150, 150, 150, 0.3)';
                    ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
                } else {
                    // Active color for upcoming notes
                    ctx.fillStyle = 'rgba(102, 126, 234, 0.3)';
                    ctx.strokeStyle = 'rgba(102, 126, 234, 0.8)';
                }

                ctx.lineWidth = 2;

                // Draw filled bar
                ctx.fillRect(
                    Math.max(0, barStartX),
                    songNote.yPosition + yOffset,
                    Math.min(barWidth, pianoRollCanvas.width - barStartX),
                    noteHeight
                );

                // Draw outline
                ctx.strokeRect(
                    Math.max(0, barStartX),
                    songNote.yPosition + yOffset,
                    Math.min(barWidth, pianoRollCanvas.width - barStartX),
                    noteHeight
                );
            }
        }

        // Auto-stop when song is finished
        if (songElapsed > songNotes[songNotes.length - 1].endTime + 2) {
            stopSong();
        }
    }

    // Draw completed note bars (player notes on top)
    for (let i = noteBars.length - 1; i >= 0; i--) {
        const bar = noteBars[i];
        const barStartX = nowX + (bar.startTime - elapsedSeconds) * PIXELS_PER_SECOND;
        const barEndX = nowX + (bar.endTime - elapsedSeconds) * PIXELS_PER_SECOND;
        const barWidth = barEndX - barStartX;

        // Remove bars that have scrolled off screen
        if (barEndX < 0) {
            noteBars.splice(i, 1);
            continue;
        }

        // Only draw bars that are visible
        if (barStartX < pianoRollCanvas.width) {
            ctx.fillStyle = bar.color;
            ctx.fillRect(
                Math.max(0, barStartX),
                bar.yPosition,
                Math.min(barWidth, pianoRollCanvas.width - barStartX),
                NOTE_HEIGHT - 2
            );

            // Draw border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                Math.max(0, barStartX),
                bar.yPosition,
                Math.min(barWidth, pianoRollCanvas.width - barStartX),
                NOTE_HEIGHT - 2
            );
        }
    }

    // Draw currently playing note (in real-time)
    if (currentNote && noteStartTime !== null && currentNote.midi) {
        const midi = currentNote.midi;
        if (midi >= MIN_MIDI && midi <= MAX_MIDI) {
            const barStartX = nowX + (noteStartTime - elapsedSeconds) * PIXELS_PER_SECOND;
            const barEndX = nowX; // Current note ends at the "now" line
            const barWidth = barEndX - barStartX;

            if (barWidth > 0 && barStartX < pianoRollCanvas.width) {
                const yPos = getYPosition(midi);
                const color = getAccuracyColor(currentNote.cents);

                // Draw with slight transparency to show it's in progress
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = color;
                ctx.fillRect(
                    Math.max(0, barStartX),
                    yPos,
                    Math.min(barWidth, pianoRollCanvas.width - barStartX),
                    NOTE_HEIGHT - 2
                );

                // Draw border
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    Math.max(0, barStartX),
                    yPos,
                    Math.min(barWidth, pianoRollCanvas.width - barStartX),
                    NOTE_HEIGHT - 2
                );
                ctx.globalAlpha = 1.0;
            }
        }
    }

    animationFrameId = requestAnimationFrame(animate);
}

// Note tracking functions
function trackNote(note) {
    const currentTime = (performance.now() - startTime) / 1000;

    // If this is a different note than the current one, finalize the previous note
    if (currentNote && currentNote.fullName !== note.fullName) {
        finalizeCurrentNote();
    }

    // Start tracking this note if it's new
    if (!currentNote || currentNote.fullName !== note.fullName) {
        currentNote = {
            fullName: note.fullName,
            cents: note.cents,
            midi: noteNameToMidi(note.fullName)
        };
        noteStartTime = currentTime;
    } else {
        // Update cents value (average it for stability)
        currentNote.cents = Math.round((currentNote.cents + note.cents) / 2);
    }
}

function finalizeCurrentNote() {
    if (!currentNote || noteStartTime === null) return;

    const currentTime = (performance.now() - startTime) / 1000;
    const duration = currentTime - noteStartTime;

    // Add all notes with valid MIDI number
    if (currentNote.midi) {
        const midi = currentNote.midi;

        // Only show notes in flute range
        if (midi >= MIN_MIDI && midi <= MAX_MIDI) {
            noteBars.push({
                note: currentNote.fullName,
                startTime: noteStartTime,
                endTime: currentTime,
                cents: currentNote.cents,
                yPosition: getYPosition(midi),
                color: getAccuracyColor(currentNote.cents)
            });
        }
    }

    currentNote = null;
    noteStartTime = null;
}

function clearTranscript() {
    noteBars.length = 0;
    currentNote = null;
    noteStartTime = null;
    startTime = performance.now();
}

// Event handlers
clearTranscriptBtn.addEventListener('click', clearTranscript);

// Song playback functions

// ABC Notation Parser
function parseABCNotation(abcString) {
    const lines = abcString.split('\n');
    let defaultLength = 1/8; // Default to eighth note
    let tempo = 120; // Default tempo (quarter notes per minute)
    let keySignature = 'C'; // Default key
    let tuneBody = '';

    // Parse header and body
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('L:')) {
            // Parse default note length (e.g., "L:1/8")
            const match = trimmed.match(/L:\s*(\d+)\/(\d+)/);
            if (match) {
                defaultLength = parseInt(match[1]) / parseInt(match[2]);
            }
        } else if (trimmed.startsWith('Q:')) {
            // Parse tempo (e.g., "Q:1/4=120")
            const match = trimmed.match(/Q:.*=(\d+)/);
            if (match) {
                tempo = parseInt(match[1]);
            }
        } else if (trimmed.startsWith('K:')) {
            // Parse key signature
            keySignature = trimmed.substring(2).trim();
        } else if (trimmed && !trimmed.match(/^[A-Z]:/)) {
            // This is part of the tune body
            tuneBody += ' ' + trimmed;
        }
    }

    // Parse the tune body
    const notes = parseABCTuneBody(tuneBody, defaultLength, tempo, keySignature);
    return { notes, tempo };
}

function parseABCTuneBody(body, defaultLength, tempo, keySignature) {
    const parsed = [];
    let currentTime = 0;

    // Remove bar lines and clean up
    body = body.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();

    // Token pattern: accidental? + note letter + octave markers? + duration?
    const tokenPattern = /(\^{1,2}|_{1,2}|=)?([A-Ga-g]|z)(,{1,2}|'{1,2})?(\d+)?(\/\d+)?/g;

    let match;
    while ((match = tokenPattern.exec(body)) !== null) {
        const accidental = match[1] || '';
        const noteLetter = match[2];
        const octaveMarker = match[3] || '';
        const multiplier = match[4] ? parseInt(match[4]) : 1;
        const divisor = match[5] ? parseInt(match[5].substring(1)) : 1;

        // Skip rests for now
        if (noteLetter === 'z') {
            const duration = (defaultLength * multiplier / divisor) * (240 / tempo); // Convert to seconds
            currentTime += duration;
            continue;
        }

        // Calculate duration in seconds
        // defaultLength is in quarter note units (e.g., 1/8 = 0.125 quarter notes)
        // tempo is quarter notes per minute
        const noteDuration = (defaultLength * multiplier / divisor) * (240 / tempo);

        // Convert ABC note to MIDI
        const midi = abcNoteToMidi(noteLetter, octaveMarker, accidental, keySignature);

        if (midi && midi >= MIN_MIDI && midi <= MAX_MIDI) {
            parsed.push({
                note: midiToNoteName(midi),
                startTime: currentTime,
                endTime: currentTime + noteDuration,
                yPosition: getYPosition(midi),
                midi: midi
            });
        }

        currentTime += noteDuration;
    }

    return parsed;
}

function abcNoteToMidi(noteLetter, octaveMarker, accidental, keySignature) {
    // Base notes (C=0, D=2, E=4, F=5, G=7, A=9, B=11)
    const noteOffsets = {
        'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
        'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
    };

    const baseNote = noteLetter.toUpperCase();
    let semitone = noteOffsets[baseNote];

    // ABC octave convention:
    // C, D, E, F, G, A, B = middle octave (C4-B4) = MIDI 60-71
    // c, d, e, f, g, a, b = one octave up (C5-B5) = MIDI 72-83
    // C,, = C2 (MIDI 36), C, = C3 (MIDI 48), C = C4 (MIDI 60), c = C5 (MIDI 72), c' = C6 (MIDI 84)

    let octave = 6; // Default for uppercase letters (C4 = MIDI 60 = (6-1)*12 = 60)

    if (noteLetter === noteLetter.toLowerCase()) {
        // Lowercase = one octave higher
        octave = 7;
    }

    // Apply octave markers
    if (octaveMarker === ",,") octave -= 2;
    else if (octaveMarker === ",") octave -= 1;
    else if (octaveMarker === "'") octave += 1;
    else if (octaveMarker === "''") octave += 2;

    // Apply accidentals
    if (accidental === '^') semitone += 1; // Sharp
    else if (accidental === '^^') semitone += 2; // Double sharp
    else if (accidental === '_') semitone -= 1; // Flat
    else if (accidental === '__') semitone -= 2; // Double flat

    // Calculate MIDI number
    // In MIDI: C4 = 60, so C5 = 72, C6 = 84, etc.
    // octave 5 in our system = C4 in scientific = MIDI 60
    const midi = (octave - 1) * 12 + semitone;

    return midi;
}

function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteName = noteNames[midi % 12];
    return noteName + octave;
}

function parseSongNotation(notation) {
    const parsed = [];
    let currentTime = 0;

    // Split by whitespace and parse each note:duration pair
    const tokens = notation.trim().split(/\s+/);

    for (const token of tokens) {
        const parts = token.split(':');
        if (parts.length !== 2) continue;

        const noteName = parts[0].trim();
        const duration = parseFloat(parts[1]);

        if (isNaN(duration) || duration <= 0) continue;

        const midi = noteNameToMidi(noteName);
        if (!midi || midi < MIN_MIDI || midi > MAX_MIDI) continue;

        parsed.push({
            note: noteName,
            startTime: currentTime,
            endTime: currentTime + duration,
            yPosition: getYPosition(midi),
            midi: midi
        });

        currentTime += duration;
    }

    return parsed;
}

function loadSongFromText() {
    const notation = songInput.value.trim();
    if (!notation) {
        alert('Please enter song notation first!');
        return false;
    }

    // Try to parse as ABC notation first (check for ABC headers or just ABC-style notes)
    if (notation.includes('K:') || notation.includes('L:') || notation.match(/[A-Ga-g][,']?[0-9/]?\s/)) {
        const result = parseABCNotation(notation);
        songNotes = result.notes;
        songOriginalTempo = result.tempo;

        // Set metronome to song tempo
        metronome.setTempo(result.tempo);
        tempoSlider.value = result.tempo;
        tempoDisplay.textContent = result.tempo;
    } else {
        // Fall back to simple notation
        songNotes = parseSongNotation(notation);
        songOriginalTempo = 120; // Default tempo for simple notation
    }

    if (songNotes.length === 0) {
        alert('No valid notes found. Please check the ABC notation format.');
        return false;
    }

    return true;
}

function playSong() {
    // Load song if not already loaded or if text has changed
    if (songNotes.length === 0) {
        if (!loadSongFromText()) {
            return;
        }
    }

    songPlaying = true;

    // Calculate start time so first note appears at far right edge
    // nowX is at 50% of canvas width, we want notes to start at 100% (right edge)
    // Time needed to scroll from right edge to nowX = (canvasWidth * 0.5) / PIXELS_PER_SECOND
    const currentElapsed = (performance.now() - startTime) / 1000;
    const scrollTime = (pianoRollCanvas.width * 0.5) / PIXELS_PER_SECOND;
    songStartTime = currentElapsed - scrollTime;

    playSongBtn.style.display = 'none';
    stopSongBtn.style.display = 'inline-block';
    songInput.disabled = true;
}

function stopSong() {
    songPlaying = false;
    songStartTime = null;

    playSongBtn.style.display = 'inline-block';
    stopSongBtn.style.display = 'none';
    songInput.disabled = false;
}

function loadExampleSong() {
    // Twinkle Twinkle Little Star in ABC notation
    songInput.value = `L:1/4
Q:1/4=120
K:C
C C G G | A A G2 | F F E E | D D C2 |
G G F F | E E D2 | G G F F | E E D2 |
C C G G | A A G2 | F F E E | D D C2 |`;

    // Load and parse the song, setting tempo
    loadSongFromText();
}

function transposeSong(semitones) {
    if (songNotes.length === 0) {
        alert('Please load a song first!');
        return;
    }

    // Stop song if playing
    if (songPlaying) {
        stopSong();
    }

    // Transpose all notes
    let transposedCount = 0;
    let outOfRangeCount = 0;

    songNotes = songNotes.map(note => {
        const newMidi = note.midi + semitones;

        // Check if new MIDI is within flute range
        if (newMidi >= MIN_MIDI && newMidi <= MAX_MIDI) {
            transposedCount++;
            return {
                ...note,
                midi: newMidi,
                note: midiToNoteName(newMidi),
                yPosition: getYPosition(newMidi)
            };
        } else {
            outOfRangeCount++;
            return note; // Keep original note if out of range
        }
    });

    if (outOfRangeCount > 0) {
        alert(`Transposed ${transposedCount} notes. ${outOfRangeCount} notes were out of flute range (C4-C7) and kept at original pitch.`);
    } else {
        alert(`Successfully transposed ${transposedCount} notes by ${semitones > 0 ? '+' : ''}${semitones} semitones.`);
    }
}

function transposeUp() {
    transposeSong(12); // +1 octave
}

function transposeDown() {
    transposeSong(-12); // -1 octave
}

// Song event handlers
playSongBtn.addEventListener('click', playSong);
stopSongBtn.addEventListener('click', stopSong);
loadExampleBtn.addEventListener('click', loadExampleSong);
transposeUpBtn.addEventListener('click', transposeUp);
transposeDownBtn.addEventListener('click', transposeDown);

// Clear song data when user edits the text (so it reloads on next play)
songInput.addEventListener('input', () => {
    if (!songInput.disabled) {  // Only clear if not currently playing
        songNotes = [];
    }
});

// Handle window resize
window.addEventListener('resize', resizeCanvas);

// Initialize piano roll when page loads
initPianoRoll();
