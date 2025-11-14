// ES Module dynamic import to load Pitchy
// This loads Pitchy as an ES module and exposes it globally for use by regular scripts

(async function() {
    try {
        const module = await import('https://cdn.jsdelivr.net/npm/pitchy@3/+esm');

        // Expose PitchDetector globally
        window.PitchDetector = module.PitchDetector;
        window.pitchyLoaded = true;

        console.log('Pitchy loaded successfully:', module);

        // Dispatch event to signal Pitchy is ready
        window.dispatchEvent(new Event('pitchyReady'));
    } catch (error) {
        console.error('Failed to load Pitchy:', error);
    }
})();
