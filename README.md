# Flute Tuner & Metronome

A browser-based flute tuner and metronome application that helps musicians practice with accurate pitch detection and tempo control.

## Features

### Tuner
- Real-time pitch detection using the Web Audio API
- Visual feedback showing:
  - Current note being played
  - Frequency in Hz
  - Cents deviation from perfect pitch (-50 to +50 cents)
  - Color-coded tuning meter (green for in-tune, yellow for close, red for out-of-tune)
- Works with any instrument, optimized for flute

### Metronome
- Adjustable tempo from 40 to 208 BPM
- Configurable time signatures (1-6 beats per measure)
- Visual beat indicators with accent on the first beat
- Audio click with distinct sound for downbeat

## Deployment on GitHub Pages

This app is ready to deploy on GitHub Pages:

1. Push your code to a GitHub repository
2. Go to your repository settings on GitHub
3. Navigate to "Pages" in the left sidebar
4. Under "Source", select the branch you want to deploy (e.g., `main` or `claude/flute-tuner-metronome-app-011CV6HvMcmcDxXTCcbmNAbo`)
5. Click "Save"
6. Your site will be published at `https://<username>.github.io/<repository-name>/`

Note: GitHub Pages automatically serves over HTTPS, which is required for microphone access.

## How to Use

1. Open `index.html` in a modern web browser (Chrome, Firefox, Safari, or Edge)
   - Or visit your GitHub Pages URL if deployed
2. Grant microphone permissions when prompted

### Using the Tuner
1. Click "Start Tuner"
2. Play your instrument
3. Watch the display for:
   - The note name and octave
   - How many cents sharp or flat you are
   - The visual meter showing tuning accuracy

### Using the Metronome
1. Adjust the tempo using the slider
2. Select beats per measure from the dropdown
3. Click "Start Metronome"
4. The beat dots will light up in sync with the audio clicks

## Technical Details

- **Pitch Detection**: Uses autocorrelation algorithm for accurate pitch detection
- **Audio Processing**: Web Audio API for both microphone input and metronome sound generation
- **No Dependencies**: Pure vanilla JavaScript, HTML, and CSS
- **Responsive Design**: Works on desktop and mobile devices

## Browser Requirements

- Modern browser with Web Audio API support
- Microphone access for tuner functionality
- HTTPS or localhost (required for microphone access)

## Testing the Tuner

A comprehensive test suite is included to verify the pitch detection accuracy:

1. Open `test.html` in your browser
2. Click "Run All Tests" to test all notes from C4 to C7 (full flute range)
3. Or click "Quick Test" to test one octave (C4 to C5)

The test suite generates synthetic tones for each note and validates:
- Correct note detection
- Frequency accuracy
- Cents deviation (±10 cents = perfect, ±25 cents = close)

Results are color-coded:
- 🟢 Green: Perfect match (±10 cents)
- 🟡 Yellow: Close match (±25 cents)
- 🔴 Red: Failed or wrong note detected

## Files

- `index.html` - Main HTML structure
- `test.html` - Automated test suite for pitch detection accuracy
- `styles.css` - Styling and layout
- `tuner.js` - Pitch detection and tuner logic
- `metronome.js` - Metronome timing and sound generation
- `app.js` - Application logic and UI event handlers
- `test-runner.js` - Test suite implementation

## License

MIT License - Feel free to use and modify for your own projects.
