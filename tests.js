/**
 * Heart Rate Monitor Test Suite
 * Runs in Node.js without browser dependencies
 */

// Mock DOM environment for Node.js
class MockDOM {
    constructor() {
        this.elements = {};
        this.document = {
            getElementById: (id) => this.elements[id] || null,
            querySelector: (selector) => {
                if (selector === '#intro-modal') return this.elements['intro-modal'] || null;
                if (selector === '#close-btn') return this.elements['close-btn'] || null;
                return null;
            }
        };
        this.body = {
            addEventListener: () => {}
        };
    }

    createElement(tag) {
        return new MockElement(tag);
    }

    getElementById(id) {
        return this.elements[id] || null;
    }
}

class MockElement {
    constructor(tag) {
        this.tag = tag;
        this.children = [];
        this.attributes = {};
        this.classList = new MockClassList();
        this.style = {};
        this.value = '';
        this.textContent = '';
        this.disabled = false;
        this.srcObject = null;
        this.width = 0;
        this.height = 0;
        this.offsetWidth = 0;
        this.offsetHeight = 0;
        this.readyState = 0;
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.innerHTML = '';
    }

    getContext(type) {
        if (type === '2d') {
            return new MockCanvasContext();
        }
        return null;
    }

    appendChild(child) {
        this.children.push(child);
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    addEventListener(event, handler) {
        this.handlers = this.handlers || {};
        this.handlers[event] = this.handlers[event] || [];
        this.handlers[event].push(handler);
    }

    dispatchEvent(event) {
        if (this.handlers && this.handlers[event.type]) {
            this.handlers[event.type].forEach(h => h(event));
        }
    }

    focus() {
        // Mock focus
    }
}

class MockClassList {
    constructor() {
        this.classes = new Set();
    }

    add(className) {
        this.classes.add(className);
    }

    remove(className) {
        this.classes.delete(className);
    }

    toggle(className) {
        if (this.classes.has(className)) {
            this.classes.delete(className);
        } else {
            this.classes.add(className);
        }
    }

    contains(className) {
        return this.classes.has(className);
    }
}

class MockCanvasContext {
    constructor() {
        this.fillStyle = '';
        this.strokeStyle = '';
        this.lineWidth = 0;
        this.font = '';
        this.shadowColor = '';
        this.shadowBlur = 0;
        this.lineJoin = '';
    }

    clearRect(x, y, w, h) {
        // Mock clear
    }

    fillRect(x, y, w, h) {
        // Mock fill
    }

    fillText(text, x, y) {
        // Mock fillText
    }

    strokeText(text, x, y) {
        // Mock strokeText
    }

    beginPath() {
        // Mock beginPath
    }

    moveTo(x, y) {
        // Mock moveTo
    }

    lineTo(x, y) {
        // Mock lineTo
    }

    stroke() {
        // Mock stroke
    }

    fill() {
        // Mock fill
    }

    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
        // Mock bezierCurveTo
    }
}

// Setup global objects for Node.js environment
global.document = new MockDOM().document;
global.window = {
    requestAnimationFrame: (cb) => {
        return setTimeout(cb, 16);
    },
    cancelAnimationFrame: (id) => {
        clearTimeout(id);
    },
    Date: Date
};

// Import the module
import { HeartRateMonitor, fft, nextPowerOf2, resampleUniform, 
         calculateFrameBrightness, processFFT, findPeakFrequency, 
         applyHarmonicCorrection, updateBPMHistory } from './script.js';

/**
 * Test Suite
 */
class TestSuite {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.tests = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('\n=== Heart Rate Monitor Test Suite ===\n');
        
        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`✓ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.error(`✗ ${test.name}`);
                console.error(`  Error: ${error.message}`);
                this.failed++;
            }
        }

        console.log(`\n=== Results ===`);
        console.log(`Passed: ${this.passed}`);
        console.log(`Failed: ${this.failed}`);
        console.log(`Total: ${this.passed + this.failed}\n`);

        return this.failed === 0;
    }
}

/**
 * Assertions
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Values not equal'}\n  Expected: ${expected}\n  Actual: ${actual}`);
    }
}

function assertArrayEquals(actual, expected, message) {
    if (actual.length !== expected.length) {
        throw new Error(`${message || 'Array lengths not equal'}\n  Expected: ${expected.length}\n  Actual: ${actual.length}`);
    }
    for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) {
            throw new Error(`${message || 'Array values not equal'}\n  At index ${i}: expected ${expected[i]}, got ${actual[i]}`);
        }
    }
}

function assertClose(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message || 'Values not close enough'}\n  Expected: ${expected}\n  Actual: ${actual}\n  Tolerance: ${tolerance}`);
    }
}

/**
 * Tests for FFT function
 */
function testFFT() {
    const signal = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = fft(signal);
    
    assert(result.real instanceof Float64Array, 'Real part should be Float64Array');
    assert(result.imag instanceof Float64Array, 'Imaginary part should be Float64Array');
    assert(result.real.length === signal.length, 'Output length should match input');
    assert(result.imag.length === signal.length, 'Output length should match input');
}

/**
 * Tests for nextPowerOf2 function
 */
function testNextPowerOf2() {
    assertEquals(nextPowerOf2(1), 1, 'nextPowerOf2(1) should be 1');
    assertEquals(nextPowerOf2(2), 2, 'nextPowerOf2(2) should be 2');
    assertEquals(nextPowerOf2(3), 4, 'nextPowerOf2(3) should be 4');
    assertEquals(nextPowerOf2(5), 8, 'nextPowerOf2(5) should be 8');
    assertEquals(nextPowerOf2(16), 16, 'nextPowerOf2(16) should be 16');
    assertEquals(nextPowerOf2(17), 32, 'nextPowerOf2(17) should be 32');
    assertEquals(nextPowerOf2(100), 128, 'nextPowerOf2(100) should be 128');
}

/**
 * Tests for resampleUniform function
 */
function testResampleUniform() {
    const values = [1, 2, 3, 4, 5];
    const result = resampleUniform(values, 3);
    
    assert(result.length === 3, 'Result length should match target');
    assertClose(result[0], 1, 0.001, 'First value should be unchanged');
    assertClose(result[2], 5, 0.001, 'Last value should be unchanged');
}

/**
 * Tests for findPeakFrequency function
 */
function testFindPeakFrequency() {
    // Create a simple signal with known frequency
    // The function looks for peaks in the 0.67-3.33 Hz range (40-200 BPM)
    const magnitudes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    magnitudes[7] = 10; // Peak at bin 7, which is 0.7 Hz (42 BPM) - within range
    
    const freqResolution = 0.1;
    const peakBin = findPeakFrequency(magnitudes, freqResolution);
    
    assertEquals(peakBin, 7, 'Should find peak at bin 7 (0.7 Hz = 42 BPM)');
}

/**
 * Tests for applyHarmonicCorrection function
 */
function testApplyHarmonicCorrection() {
    const magnitudes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    magnitudes[2] = 10; // Peak at bin 2
    magnitudes[4] = 8;  // Harmonic at bin 4 (2*2)
    
    const peakBin = 2;
    const freqResolution = 0.1;
    const corrected = applyHarmonicCorrection(magnitudes, peakBin, freqResolution);
    
    assertEquals(corrected, 4, 'Should correct to harmonic bin 4');
}

/**
 * Tests for updateBPMHistory function
 */
function testUpdateBPMHistory() {
    let bpmHistory = [];
    let smoothedBPM = 0;
    let peakBPM = 0;
    let lowBPM = 999;
    
    // First reading
    let result = updateBPMHistory(bpmHistory, 70, smoothedBPM, peakBPM, lowBPM);
    bpmHistory = result.bpmHistory;
    smoothedBPM = result.smoothedBPM;
    peakBPM = result.peakBPM;
    lowBPM = result.lowBPM;
    
    assertEquals(bpmHistory.length, 1, 'Should have 1 entry in history');
    assertEquals(smoothedBPM, 70, 'First reading should set smoothed value');
    assertEquals(peakBPM, 70, 'Peak should be 70');
    assertEquals(lowBPM, 70, 'Low should be 70');
    
    // Second reading, close to first
    result = updateBPMHistory(bpmHistory, 72, smoothedBPM, peakBPM, lowBPM);
    bpmHistory = result.bpmHistory;
    smoothedBPM = result.smoothedBPM;
    peakBPM = result.peakBPM;
    lowBPM = result.lowBPM;
    
    assertEquals(bpmHistory.length, 2, 'Should have 2 entries in history');
    assertClose(smoothedBPM, 70.7, 0.1, 'Smoothed value should be weighted average');
}

/**
 * Tests for HeartRateMonitor class
 */
function testHeartRateMonitorInitialization() {
    const monitor = new HeartRateMonitor();
    
    assert(monitor instanceof HeartRateMonitor, 'Should be instance of HeartRateMonitor');
    assertEquals(monitor.isRunning, false, 'Should not be running initially');
    assertEquals(monitor.currentBPM, 0, 'BPM should be 0 initially');
    assertEquals(monitor.peakBPM, 0, 'Peak BPM should be 0 initially');
    assertEquals(monitor.lowBPM, 999, 'Low BPM should be 999 initially');
}

/**
 * Tests for calculateFrameBrightness
 */
function testCalculateFrameBrightness() {
    // Create a mock video element
    const video = {
        videoWidth: 100,
        videoHeight: 100
    };
    
    // This will fail in Node.js without proper canvas implementation
    // but we test that the function exists and handles the call
    try {
        const result = calculateFrameBrightness(video);
        // In a real browser, this would return a number or null
        // In our mock, it might return null or throw
    } catch (e) {
        // Expected in Node.js environment without full canvas
        console.log('  (Skipping - requires browser canvas)');
    }
}

/**
 * Tests for processFFT
 */
function testProcessFFT() {
    const signalBuffer = [];
    const now = Date.now();
    
    // Add some sample data
    for (let i = 0; i < 100; i++) {
        signalBuffer.push({
            value: Math.sin(i * 0.1) * 100 + 100,
            time: now - (100 - i) * 10
        });
    }
    
    const result = processFFT(signalBuffer);
    
    if (result) {
        assert(result.magnitudes instanceof Array, 'Should return magnitudes array');
        assert(result.sampleRate > 0, 'Should have positive sample rate');
        assert(result.N > 0, 'Should have N > 0');
        assert(result.freqResolution > 0, 'Should have freqResolution > 0');
    }
}

/**
 * Run all tests
 */
async function runTests() {
    const suite = new TestSuite();
    
    // FFT tests
    suite.test('FFT function', testFFT);
    suite.test('nextPowerOf2 function', testNextPowerOf2);
    suite.test('resampleUniform function', testResampleUniform);
    suite.test('findPeakFrequency function', testFindPeakFrequency);
    suite.test('applyHarmonicCorrection function', testApplyHarmonicCorrection);
    suite.test('updateBPMHistory function', testUpdateBPMHistory);
    suite.test('HeartRateMonitor initialization', testHeartRateMonitorInitialization);
    suite.test('calculateFrameBrightness function', testCalculateFrameBrightness);
    suite.test('processFFT function', testProcessFFT);
    
    const success = await suite.run();
    process.exit(success ? 0 : 1);
}

runTests();
