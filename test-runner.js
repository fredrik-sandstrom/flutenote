// Test runner for pitch detection accuracy
// Uses Pitchy library directly for testing

const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Create a tuner instance to use its frequencyToNote method
const testTuner = new Tuner();

// Create Pitchy detector for testing
const testBufferSize = 2048;
const PitchDetector = Pitchy.default || Pitchy.PitchDetector || Pitchy;
const pitchDetector = PitchDetector.forFloat32Array(testBufferSize);

function noteToFrequency(noteName, octave) {
    // Convert note name and octave to frequency
    const noteIndex = noteStrings.indexOf(noteName);
    if (noteIndex === -1) return null;

    const midiNote = (octave + 1) * 12 + noteIndex;
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    return frequency;
}

// Generate a synthetic tone buffer
function generateTone(frequency, durationSeconds = 0.5, sampleRate = 48000) {
    const bufferLength = Math.floor(durationSeconds * sampleRate);
    const buffer = new Float32Array(bufferLength);

    // Generate a pure sine wave
    for (let i = 0; i < bufferLength; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }

    return buffer;
}

// Test a single note using Pitchy library
function testNote(noteName, octave) {
    const expectedFrequency = noteToFrequency(noteName, octave);
    const expectedNote = `${noteName}${octave}`;

    // Generate synthetic tone
    const sampleRate = 48000;
    const buffer = generateTone(expectedFrequency, 0.5, sampleRate);

    // Run pitch detection using Pitchy
    const testBuffer = buffer.slice(0, testBufferSize);
    const [detectedFrequency, clarity] = pitchDetector.findPitch(testBuffer, sampleRate);

    if (!detectedFrequency || clarity < 0.5) {
        return {
            expectedNote,
            expectedFrequency: expectedFrequency.toFixed(2),
            detectedNote: 'N/A',
            detectedFrequency: 'N/A',
            centsOff: 'N/A',
            result: 'error',
            resultText: `Detection Failed (clarity: ${clarity ? clarity.toFixed(2) : 'N/A'})`
        };
    }

    // Use the actual frequencyToNote method from the Tuner class
    const detectedNoteInfo = testTuner.frequencyToNote(detectedFrequency);
    const frequencyError = Math.abs(detectedFrequency - expectedFrequency);
    const frequencyErrorPercent = (frequencyError / expectedFrequency) * 100;

    // Calculate cents difference more accurately
    const centsOff = Math.round(1200 * Math.log2(detectedFrequency / expectedFrequency));

    // Determine result
    let result, resultText;
    if (detectedNoteInfo.fullName === expectedNote && Math.abs(centsOff) <= 10) {
        result = 'pass';
        resultText = '✓ Perfect';
    } else if (detectedNoteInfo.fullName === expectedNote && Math.abs(centsOff) <= 25) {
        result = 'close';
        resultText = '~ Close';
    } else {
        result = 'fail';
        resultText = '✗ Failed';
    }

    return {
        expectedNote,
        expectedFrequency: expectedFrequency.toFixed(2),
        detectedNote: detectedNoteInfo.fullName,
        detectedFrequency: detectedFrequency.toFixed(2),
        centsOff: centsOff,
        result,
        resultText,
        frequencyErrorPercent: frequencyErrorPercent.toFixed(2)
    };
}

// Generate test cases for flute range
function generateTestCases(quick = false) {
    const tests = [];

    if (quick) {
        // Quick test: Just C4 to C5 (one octave)
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'];
        const octave = 4;

        notes.forEach(note => {
            const oct = note === 'C' && tests.length > 0 ? octave + 1 : octave;
            tests.push({ note, octave: oct });
        });
    } else {
        // Full test: C4 to C7 (flute range)
        for (let octave = 4; octave <= 6; octave++) {
            noteStrings.forEach(note => {
                tests.push({ note, octave });
            });
        }
        // Add final C7
        tests.push({ note: 'C', octave: 7 });
    }

    return tests;
}

// Run all tests
async function runTests(quick = false) {
    const runButton = document.getElementById('runTests');
    const quickButton = document.getElementById('runQuickTests');
    const clearButton = document.getElementById('clearResults');
    const resultsBody = document.getElementById('resultsBody');
    const progress = document.getElementById('progress');
    const progressFill = document.getElementById('progressFill');
    const summary = document.getElementById('summary');

    // Disable buttons
    runButton.disabled = true;
    quickButton.disabled = true;

    // Clear previous results
    resultsBody.innerHTML = '';

    // Show progress
    progress.classList.add('active');
    summary.classList.remove('active');

    const testCases = generateTestCases(quick);
    let passCount = 0;
    let closeCount = 0;
    let failCount = 0;

    for (let i = 0; i < testCases.length; i++) {
        const { note, octave } = testCases[i];

        // Update progress
        const progressPercent = Math.round(((i + 1) / testCases.length) * 100);
        progressFill.style.width = `${progressPercent}%`;
        progressFill.textContent = `Testing ${note}${octave} (${i + 1}/${testCases.length})`;

        // Run test using Pitchy library
        const result = testNote(note, octave);

        // Update counts
        if (result.result === 'pass') passCount++;
        else if (result.result === 'close') closeCount++;
        else failCount++;

        // Add row to table
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${i + 1}</td>
            <td><strong>${result.expectedNote}</strong></td>
            <td>${result.expectedFrequency}</td>
            <td><strong>${result.detectedNote}</strong></td>
            <td>${result.detectedFrequency}</td>
            <td>${result.centsOff !== 'N/A' ? (result.centsOff > 0 ? '+' : '') + result.centsOff : 'N/A'}</td>
            <td class="result-${result.result}">${result.resultText}</td>
        `;
        resultsBody.appendChild(row);

        // Small delay to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Hide progress, show summary
    progress.classList.remove('active');
    summary.classList.add('active');

    // Update summary
    document.getElementById('passCount').textContent = passCount;
    document.getElementById('closeCount').textContent = closeCount;
    document.getElementById('failCount').textContent = failCount;

    const totalTests = testCases.length;
    const accuracyPercent = Math.round(((passCount + closeCount) / totalTests) * 100);
    document.getElementById('accuracyPercent').textContent = `${accuracyPercent}%`;

    // Color code accuracy
    const accuracyElement = document.getElementById('accuracyPercent');
    if (accuracyPercent >= 90) {
        accuracyElement.className = 'stat-value success';
    } else if (accuracyPercent >= 70) {
        accuracyElement.className = 'stat-value warning';
    } else {
        accuracyElement.className = 'stat-value error';
    }

    // Re-enable buttons
    runButton.disabled = false;
    quickButton.disabled = false;
    clearButton.style.display = 'inline-block';
}

// Clear results
function clearResults() {
    const resultsBody = document.getElementById('resultsBody');
    const summary = document.getElementById('summary');
    const clearButton = document.getElementById('clearResults');

    resultsBody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; color: #999; padding: 40px;">
                Click "Run All Tests" to begin testing the pitch detection algorithm
            </td>
        </tr>
    `;

    summary.classList.remove('active');
    clearButton.style.display = 'none';
}

// Event listeners
document.getElementById('runTests').addEventListener('click', () => runTests(false));
document.getElementById('runQuickTests').addEventListener('click', () => runTests(true));
document.getElementById('clearResults').addEventListener('click', clearResults);
