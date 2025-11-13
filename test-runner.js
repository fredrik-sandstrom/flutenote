// Pitch detection and note conversion functions (copied from tuner.js)
const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function autoCorrelate(buffer, sampleRate) {
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

function frequencyToNote(frequency) {
    // Convert frequency to note name and cents offset
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const noteIndex = Math.round(noteNum) + 69; // MIDI note number (A4 = 69)
    const cents = Math.floor((noteNum - Math.round(noteNum)) * 100);

    const octave = Math.floor(noteIndex / 12) - 1;
    const noteName = noteStrings[noteIndex % 12];

    return {
        name: noteName,
        octave: octave,
        frequency: frequency,
        cents: cents,
        fullName: `${noteName}${octave}`
    };
}

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

// Test a single note
function testNote(noteName, octave) {
    const expectedFrequency = noteToFrequency(noteName, octave);
    const expectedNote = `${noteName}${octave}`;

    // Generate synthetic tone
    const sampleRate = 48000;
    const buffer = generateTone(expectedFrequency, 0.5, sampleRate);

    // Run pitch detection on a slice of the buffer (simulate what the tuner does)
    const testBufferSize = 2048;
    const testBuffer = buffer.slice(0, testBufferSize);

    // Detect pitch
    const detectedFrequency = autoCorrelate(testBuffer, sampleRate);

    if (detectedFrequency === -1 || !detectedFrequency) {
        return {
            expectedNote,
            expectedFrequency: expectedFrequency.toFixed(2),
            detectedNote: 'N/A',
            detectedFrequency: 'N/A',
            centsOff: 'N/A',
            result: 'error',
            resultText: 'Detection Failed'
        };
    }

    const detectedNoteInfo = frequencyToNote(detectedFrequency);
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
        for (let octave = 4; octave <= 7; octave++) {
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

        // Run test
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
