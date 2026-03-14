class HeartRateMonitor {
    constructor() {
        this.video = document.getElementById('video');
        this.bpmDisplay = document.getElementById('bpm');
        this.canvas = document.getElementById('graph');
        this.ctx = this.canvas.getContext('2d');
        this.fftCanvas = document.getElementById('fft-graph');
        this.fftCtx = this.fftCanvas.getContext('2d');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.torchBtn = document.getElementById('torchBtn');

        // Retro UI elements
        this.pixelCanvas   = document.getElementById('pixelCanvas');
        this.pixelCtx      = this.pixelCanvas ? this.pixelCanvas.getContext('2d') : null;
        this.statusDot     = document.getElementById('statusDot');
        this.statusLabel   = document.getElementById('statusLabel');
        this.heartIcon     = document.getElementById('heartIcon');
        this.bpmBar        = document.getElementById('bpmBar');
        this.statCurrent   = document.getElementById('statCurrent');
        this.statAvg       = document.getElementById('statAvg');
        this.statPeak      = document.getElementById('statPeak');
        this.statLow       = document.getElementById('statLow');
        this.sampleCount   = document.getElementById('sampleCount');
        this.peakBPM       = 0;
        this.lowBPM        = 999;
        this.lastPixelUpdate = 0;
        this.PIXEL_COLS    = 48;

        this.stream = null;
        this.animationId = null;
        this.isRunning = false;
        this.currentBPM = 0;
        this.pulseData = [];
        this.lastUpdate = 0;
        this.lastGraphUpdate = 0;

        // Rolling buffer of per-frame mean red-channel values, with timestamps
        this.signalBuffer = [];        // { value, time }  — raw camera signal
        this.MAX_SIGNAL_DURATION = 10; // seconds of signal to keep in buffer

        // Waveform display: keep a separate fixed-length ring for the scrolling display
        // so the graph always shows exactly WAVEFORM_WINDOW seconds, auto-scaled
        this.WAVEFORM_WINDOW = 5;      // seconds visible in the waveform graph
        this.waveformDisplay = [];     // { value, time } trimmed to WAVEFORM_WINDOW

        // BPM history: store timestamped readings at full sample rate, smoothed for display
        this.bpmHistory = [];          // { value, time } — one entry per analyzeSignal call
        this.BPM_HISTORY_WINDOW = 30;  // seconds of BPM history to show

        this.smoothedBPM = 0;   // exponential moving average across readings
        this.torchEnabled = false;

        this.setupEventListeners();
        this.setupCanvas();
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.torchBtn.addEventListener('click', () => this.toggleTorch());
    }

    setupCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.fftCanvas.width = this.fftCanvas.offsetWidth;
        this.fftCanvas.height = this.fftCanvas.offsetHeight;
    }

    async start() {
        try {
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 200 },
                    height: { ideal: 200 },
                    advanced: [
                        { whiteBalanceMode: 'manual' },
                        { exposureMode: 'manual' }
                    ]
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            this.isRunning = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.signalBuffer = [];
            this.waveformDisplay = [];
            this.bpmHistory = [];
            this.pulseData = [];
            this.currentBPM = 0;
            this.smoothedBPM = 0;
            this.peakBPM = 0;
            this.lowBPM = 999;
            if (this.statusDot)   { this.statusDot.classList.add('active'); }
            if (this.statusLabel) { this.statusLabel.textContent = 'ACQUIRING'; }

            this.processFrame();
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Could not access the camera. Please check permissions.');
        }
    }

    stop() {
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        if (this.statusDot)   { this.statusDot.classList.remove('active'); }
        if (this.statusLabel) { this.statusLabel.textContent = 'STANDBY'; }
        if (this.heartIcon)   { this.heartIcon.classList.remove('beating'); }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }

    async toggleTorch() {
        if (!this.stream) return;

        const track = this.stream.getVideoTracks()[0];
        if (!track) return;

        try {
            const capabilities = track.getCapabilities();
            if (capabilities.torch) {
                this.torchEnabled = !this.torchEnabled;
                await track.applyConstraints({
                    advanced: [{ torch: this.torchEnabled }]
                });
                this.torchBtn.innerHTML = this.torchEnabled
                    ? '<span class="icon">🔦</span> Flash Off'
                    : '<span class="icon">💡</span> Torch';
            } else {
                alert('Torch is not supported on this device.');
            }
        } catch (error) {
            console.error('Error toggling torch:', error);
        }
    }

    processFrame() {
        if (!this.isRunning) return;

        if (this.video.readyState < 2) {
            this.animationId = requestAnimationFrame(() => this.processFrame());
            return;
        }

        const now = Date.now();

        // Sample the raw signal on every animation frame for good FFT resolution
        this.sampleFrame(now);

        // Update BPM analysis once per second
        if (now - this.lastUpdate >= 1000) {
            this.lastUpdate = now;
            this.analyzeSignal();
            this.updateDisplay();
        }

        // Update graphs + pixel camera at ~25 fps
        if (now - this.lastGraphUpdate >= 40) {
            this.lastGraphUpdate = now;
            this.updateGraph();
            this.updateFFTGraph();
            this.renderPixelCamera();
        }

        this.animationId = requestAnimationFrame(() => this.processFrame());
    }

    // --- Signal sampling ---

    sampleFrame(now) {
        if (this.video.videoWidth === 0 || this.video.videoHeight === 0) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);

        const w = canvas.width;
        const h = canvas.height;
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Sample the center quarter of the frame
        const x0 = Math.floor(w / 4);
        const x1 = Math.floor(3 * w / 4);
        const y0 = Math.floor(h / 4);
        const y1 = Math.floor(3 * h / 4);
        const step = 2;

        let sum = 0;
        let count = 0;
        for (let y = y0; y < y1; y += step) {
            for (let x = x0; x < x1; x += step) {
                const idx = (y * w + x) * 4;
                // Use red channel — most sensitive to blood-volume changes under torch
                sum += data[idx];
                count++;
            }
        }

        if (count > 0) {
            const sample = { value: sum / count, time: now };
            this.signalBuffer.push(sample);
            this.waveformDisplay.push({ value: sample.value, time: now });
        }

        // Trim main buffer to MAX_SIGNAL_DURATION seconds
        const cutoff = now - this.MAX_SIGNAL_DURATION * 1000;
        while (this.signalBuffer.length > 0 && this.signalBuffer[0].time < cutoff) {
            this.signalBuffer.shift();
        }

        // Trim waveform display buffer to WAVEFORM_WINDOW seconds
        const wCutoff = now - this.WAVEFORM_WINDOW * 1000;
        while (this.waveformDisplay.length > 0 && this.waveformDisplay[0].time < wCutoff) {
            this.waveformDisplay.shift();
        }
    }

    // --- FFT analysis ---

    analyzeSignal() {
        if (this.signalBuffer.length < 64) return; // Need enough data

        const values = this.signalBuffer.map(s => s.value);

        // Resample to a uniform grid via linear interpolation
        const N = this.nextPowerOf2(values.length);
        const resampled = this.resampleUniform(values, N);

        // Estimate sample rate from the buffer
        const duration = (this.signalBuffer[this.signalBuffer.length - 1].time - this.signalBuffer[0].time) / 1000;
        const sampleRate = (this.signalBuffer.length - 1) / duration; // samples/sec

        // Remove DC offset
        const mean = resampled.reduce((a, b) => a + b, 0) / resampled.length;
        const signal = resampled.map(v => v - mean);

        // Apply Hann window to reduce spectral leakage
        const windowed = signal.map((v, i) => v * 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1))));

        // Compute FFT magnitudes
        const { real, imag } = this.fft(windowed);
        const magnitudes = [];
        for (let i = 0; i < N / 2; i++) {
            magnitudes.push(Math.sqrt(real[i] * real[i] + imag[i] * imag[i]));
        }

        // Store magnitudes for the FFT graph
        this.fftMagnitudes = magnitudes;
        this.fftSampleRate = sampleRate;
        this.fftN = N;

        // Find the dominant frequency in the 0.67–3.33 Hz range (40–200 BPM)
        const freqResolution = sampleRate / N;
        const minBin = Math.ceil(0.67 / freqResolution);
        const maxBin = Math.floor(3.33 / freqResolution);

        let peakBin = minBin;
        let peakMag = -Infinity;
        for (let i = minBin; i <= Math.min(maxBin, magnitudes.length - 1); i++) {
            if (magnitudes[i] > peakMag) {
                peakMag = magnitudes[i];
                peakBin = i;
            }
        }

        // ── Harmonic correction ────────────────────────────────────────────────
        // The PPG waveform has a dicrotic notch (two bumps per beat), so the FFT
        // often finds a strong sub-harmonic at f/2 (half the true heart rate).
        // If doubling the candidate frequency stays in range AND its bin has at
        // least 40% of the peak's energy, the sub-harmonic fooled us — use 2×.
        const harmonicBin = peakBin * 2;
        if (harmonicBin <= Math.min(maxBin, magnitudes.length - 1)) {
            // Also check the two neighbouring bins around the harmonic for robustness
            const harmonicMag = Math.max(
                magnitudes[harmonicBin - 1] || 0,
                magnitudes[harmonicBin]     || 0,
                magnitudes[harmonicBin + 1] || 0
            );
            if (harmonicMag >= peakMag * 0.40) {
                peakBin = harmonicBin;
            }
        }

        const rawBPM = Math.round(peakBin * freqResolution * 60);

        // ── Exponential moving average smoothing ──────────────────────────────
        // Damps single-frame jumps. α=0.35 → new reading gets 35% weight,
        // history gets 65%. Higher α = more responsive, lower = more stable.
        if (rawBPM >= 40 && rawBPM <= 200) {
            if (this.smoothedBPM === 0) {
                // First valid reading — seed the filter directly
                this.smoothedBPM = rawBPM;
            } else {
                // Widen alpha if the raw reading is far from the smoothed value
                // to recover quickly from a sustained true change in heart rate
                const delta = Math.abs(rawBPM - this.smoothedBPM);
                const alpha = delta > 20 ? 0.6 : 0.35;
                this.smoothedBPM = alpha * rawBPM + (1 - alpha) * this.smoothedBPM;
            }

            const bpm = Math.round(this.smoothedBPM);
            this.currentBPM = bpm;

            const now = this.signalBuffer.length > 0
                ? this.signalBuffer[this.signalBuffer.length - 1].time
                : Date.now();
            this.bpmHistory.push({ value: bpm, time: now });
            const cutoff = now - this.BPM_HISTORY_WINDOW * 1000;
            while (this.bpmHistory.length > 0 && this.bpmHistory[0].time < cutoff) {
                this.bpmHistory.shift();
            }
            this.pulseData.push(bpm);
            if (this.pulseData.length > 60) this.pulseData.shift();
        }
    }

    // --- FFT (Cooley-Tukey, in-place, radix-2) ---

    fft(signal) {
        const N = signal.length;
        const real = Float64Array.from(signal);
        const imag = new Float64Array(N);

        // Bit-reversal permutation
        let j = 0;
        for (let i = 1; i < N; i++) {
            let bit = N >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
        }

        // Butterfly operations
        for (let len = 2; len <= N; len <<= 1) {
            const ang = -2 * Math.PI / len;
            const wRe = Math.cos(ang);
            const wIm = Math.sin(ang);
            for (let i = 0; i < N; i += len) {
                let curRe = 1, curIm = 0;
                for (let k = 0; k < len / 2; k++) {
                    const uRe = real[i + k];
                    const uIm = imag[i + k];
                    const vRe = real[i + k + len / 2] * curRe - imag[i + k + len / 2] * curIm;
                    const vIm = real[i + k + len / 2] * curIm + imag[i + k + len / 2] * curRe;
                    real[i + k] = uRe + vRe;
                    imag[i + k] = uIm + vIm;
                    real[i + k + len / 2] = uRe - vRe;
                    imag[i + k + len / 2] = uIm - vIm;
                    const newRe = curRe * wRe - curIm * wIm;
                    curIm = curRe * wIm + curIm * wRe;
                    curRe = newRe;
                }
            }
        }

        return { real, imag };
    }

    nextPowerOf2(n) {
        let p = 1;
        while (p < n) p <<= 1;
        return p;
    }

    resampleUniform(values, targetLength) {
        const result = new Array(targetLength);
        const ratio = (values.length - 1) / (targetLength - 1);
        for (let i = 0; i < targetLength; i++) {
            const pos = i * ratio;
            const lo = Math.floor(pos);
            const hi = Math.min(lo + 1, values.length - 1);
            const t = pos - lo;
            result[i] = values[lo] * (1 - t) + values[hi] * t;
        }
        return result;
    }

    // --- Display & graphs ---

    updateDisplay() {
        const bpm = this.currentBPM;
        this.bpmDisplay.textContent = bpm > 0 ? bpm.toString().padStart(3, '0') : '---';

        if (bpm > 0) {
            // BPM bar (40–200 range)
            const pct = Math.min(100, Math.max(0, ((bpm - 40) / 160) * 100));
            if (this.bpmBar) this.bpmBar.style.width = pct + '%';

            // Peak/low tracking
            if (bpm > this.peakBPM) this.peakBPM = bpm;
            if (bpm < this.lowBPM)  this.lowBPM  = bpm;

            // Stats
            const vals = this.bpmHistory.map(p => p.value);
            const avg  = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : '--';
            if (this.statCurrent) this.statCurrent.textContent = bpm;
            if (this.statAvg)     this.statAvg.textContent     = avg;
            if (this.statPeak)    this.statPeak.textContent    = this.peakBPM;
            if (this.statLow)     this.statLow.textContent     = this.lowBPM < 999 ? this.lowBPM : '--';

            // Alert color for high BPM
            if (this.bpmDisplay) {
                this.bpmDisplay.classList.toggle('alert', bpm > 150);
            }

            // Heart beating animation
            if (this.heartIcon) this.heartIcon.classList.add('beating');

            // Status
            if (this.statusLabel) this.statusLabel.textContent = 'MONITORING';
        }

        // Sample counter
        if (this.sampleCount) {
            this.sampleCount.textContent = 'SAMPLES: ' + this.signalBuffer.length;
        }
    }

    // --- Pixel camera renderer ---
    renderPixelCamera() {
        if (!this.pixelCtx || !this.pixelCanvas) return;
        if (this.video.readyState < 2) return;

        const now = Date.now();
        if (now - this.lastPixelUpdate < 50) return; // ~20fps
        this.lastPixelUpdate = now;

        const cols = this.PIXEL_COLS;
        const pw   = this.pixelCanvas.offsetWidth  || 240;
        const ph   = this.pixelCanvas.offsetHeight || 240;
        this.pixelCanvas.width  = pw;
        this.pixelCanvas.height = ph;

        // Draw video downscaled to a tiny offscreen canvas
        const offscreen = document.createElement('canvas');
        offscreen.width  = cols;
        offscreen.height = cols;
        const octx = offscreen.getContext('2d');
        octx.drawImage(this.video, 0, 0, cols, cols);
        const imgData = octx.getImageData(0, 0, cols, cols).data;

        const cellW = pw / cols;
        const cellH = ph / cols;

        for (let row = 0; row < cols; row++) {
            for (let col = 0; col < cols; col++) {
                const idx = (row * cols + col) * 4;
                const r = imgData[idx];
                const g = imgData[idx+1];
                const b = imgData[idx+2];

                // Map brightness to green phosphor intensity
                const lum = 0.299*r + 0.587*g + 0.114*b;
                const intensity = lum / 255;

                // Phosphor green tint: mix toward green channel
                const pr = Math.round(r * intensity * 0.15);
                const pg = Math.round(Math.min(255, lum * 1.1));
                const pb = Math.round(g * intensity * 0.25);

                this.pixelCtx.fillStyle = `rgb(${pr},${pg},${pb})`;
                this.pixelCtx.fillRect(
                    Math.floor(col * cellW),
                    Math.floor(row * cellH),
                    Math.ceil(cellW),
                    Math.ceil(cellH)
                );
            }
        }

        // Subtle scanline overlay on the pixel canvas
        this.pixelCtx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let y = 0; y < ph; y += 3) {
            this.pixelCtx.fillRect(0, y, pw, 1);
        }
    }

    updateGraph() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const pts = this.bpmHistory;
        if (pts.length < 2) return;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const BPM_MIN = 40;
        const BPM_MAX = 200;
        const pad = 4; // px padding top/bottom

        // Time axis: map the last BPM_HISTORY_WINDOW seconds onto full width
        const now = pts[pts.length - 1].time;
        const windowMs = this.BPM_HISTORY_WINDOW * 1000;
        const tStart = now - windowMs;

        const toX = (t) => ((t - tStart) / windowMs) * width;
        const toY = (v) => pad + (1 - (v - BPM_MIN) / (BPM_MAX - BPM_MIN)) * (height - pad * 2);

        // Draw grid lines at 60, 80, 100, 120, 140 BPM
        this.ctx.strokeStyle = '#0d2e16';
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = '#1a5c2e';
        this.ctx.font = '10px sans-serif';
        for (const bpmLine of [60, 80, 100, 120, 140]) {
            const y = Math.round(toY(bpmLine)) + 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // Draw smooth curve using cardinal spline (Catmull-Rom) through BPM points
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#00ff88';
        this.ctx.shadowBlur = 6;
        this.ctx.lineJoin = 'round';

        const xs = pts.map(p => toX(p.time));
        const ys = pts.map(p => toY(p.value));

        this.ctx.moveTo(xs[0], ys[0]);

        for (let i = 0; i < pts.length - 1; i++) {
            // Catmull-Rom control points
            const p0 = i > 0 ? i - 1 : i;
            const p1 = i;
            const p2 = i + 1;
            const p3 = i < pts.length - 2 ? i + 2 : i + 1;

            const cp1x = xs[p1] + (xs[p2] - xs[p0]) / 6;
            const cp1y = ys[p1] + (ys[p2] - ys[p0]) / 6;
            const cp2x = xs[p2] - (xs[p3] - xs[p1]) / 6;
            const cp2y = ys[p2] - (ys[p3] - ys[p1]) / 6;

            this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xs[p2], ys[p2]);
        }

        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    updateFFTGraph() {
        this.fftCtx.clearRect(0, 0, this.fftCanvas.width, this.fftCanvas.height);

        const pts = this.waveformDisplay;
        if (pts.length < 2) return;

        const width = this.fftCanvas.width;
        const height = this.fftCanvas.height;
        const pad = 6;

        // Auto-scale: find min/max of visible window
        let minVal = Infinity, maxVal = -Infinity;
        for (const p of pts) {
            if (p.value < minVal) minVal = p.value;
            if (p.value > maxVal) maxVal = p.value;
        }
        // Add 10% headroom so the waveform doesn't clip the edges
        const range = (maxVal - minVal) || 1;
        const lo = minVal - range * 0.1;
        const hi = maxVal + range * 0.1;
        const visRange = hi - lo;

        // Time axis spans exactly WAVEFORM_WINDOW seconds, right-anchored to now
        const now = Date.now();
        const windowMs = this.WAVEFORM_WINDOW * 1000;
        const tStart = now - windowMs;

        const toX = (t) => ((t - tStart) / windowMs) * width;
        const toY = (v) => pad + (1 - (v - lo) / visRange) * (height - pad * 2);

        // Draw subtle centre baseline
        this.fftCtx.strokeStyle = '#0d2e16';
        this.fftCtx.lineWidth = 1;
        const midY = Math.round(toY((hi + lo) / 2)) + 0.5;
        this.fftCtx.beginPath();
        this.fftCtx.moveTo(0, midY);
        this.fftCtx.lineTo(width, midY);
        this.fftCtx.stroke();

        // Draw the waveform as a smooth Catmull-Rom spline
        this.fftCtx.beginPath();
        this.fftCtx.strokeStyle = '#00ff88';
        this.fftCtx.lineWidth = 2;
        this.fftCtx.shadowColor = '#00ff88';
        this.fftCtx.shadowBlur = 6;
        this.fftCtx.lineJoin = 'round';

        const xs = pts.map(p => toX(p.time));
        const ys = pts.map(p => toY(p.value));

        this.fftCtx.moveTo(xs[0], ys[0]);

        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = i > 0 ? i - 1 : i;
            const p1 = i;
            const p2 = i + 1;
            const p3 = i < pts.length - 2 ? i + 2 : i + 1;

            const cp1x = xs[p1] + (xs[p2] - xs[p0]) / 6;
            const cp1y = ys[p1] + (ys[p2] - ys[p0]) / 6;
            const cp2x = xs[p2] - (xs[p3] - xs[p1]) / 6;
            const cp2y = ys[p2] - (ys[p3] - ys[p1]) / 6;

            this.fftCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xs[p2], ys[p2]);
        }

        this.fftCtx.stroke();
        this.fftCtx.shadowBlur = 0;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HeartRateMonitor();
});
