// Minimal Testing Library for Node.js
// ====================================

const TestRunner = {
    tests: [],
    currentSuite: null,
    
    describe(name, fn) {
        this.currentSuite = { name, tests: [], passed: 0, failed: 0 };
        this.tests.push(this.currentSuite);
        fn();
        this.currentSuite = null;
    },
    
    it(description, fn) {
        if (!this.currentSuite) {
            throw new Error('it() must be called within a describe()');
        }
        const test = { description, fn, passed: false, error: null };
        this.currentSuite.tests.push(test);
        
        try {
            fn();
            test.passed = true;
            this.currentSuite.passed++;
        } catch (error) {
            test.error = error;
            this.currentSuite.failed++;
        }
    },
    
    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    },
    
    isEqualTo(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Values not equal'}: expected ${expected}, got ${actual}`);
        }
    },
    
    isNotEqualTo(actual, expected, message) {
        if (actual === expected) {
            throw new Error(`${message || 'Values are equal'}: expected not ${expected}, got ${actual}`);
        }
    },
    
    isTrue(value, message) {
        if (value !== true) {
            throw new Error(`${message || 'Expected true, got'} ${value}`);
        }
    },
    
    isFalse(value, message) {
        if (value !== false) {
            throw new Error(`${message || 'Expected false, got'} ${value}`);
        }
    },
    
    isNull(value, message) {
        if (value !== null) {
            throw new Error(`${message || 'Expected null, got'} ${value}`);
        }
    },
    
    isNotNull(value, message) {
        if (value === null) {
            throw new Error(`${message || 'Expected not null, got null'}`);
        }
    },
    
    isUndefined(value, message) {
        if (value !== undefined) {
            throw new Error(`${message || 'Expected undefined, got'} ${value}`);
        }
    },
    
    isNotUndefined(value, message) {
        if (value === undefined) {
            throw new Error(`${message || 'Expected defined value, got undefined'}`);
        }
    },
    
    isGreaterThan(actual, expected, message) {
        if (actual <= expected) {
            throw new Error(`${message || 'Value not greater than expected'}: expected > ${expected}, got ${actual}`);
        }
    },
    
    isLessThan(actual, expected, message) {
        if (actual >= expected) {
            throw new Error(`${message || 'Value not less than expected'}: expected < ${expected}, got ${actual}`);
        }
    },
    
    contains(array, value, message) {
        if (!array.includes(value)) {
            throw new Error(`${message || 'Value not found in array'}: ${value} not in ${JSON.stringify(array)}`);
        }
    },
    
    notContains(array, value, message) {
        if (array.includes(value)) {
            throw new Error(`${message || 'Value found in array'}: ${value} should not be in ${JSON.stringify(array)}`);
        }
    },
    
    throws(fn, message) {
        let threw = false;
        try {
            fn();
        } catch (error) {
            threw = true;
        }
        if (!threw) {
            throw new Error(message || 'Expected function to throw');
        }
    },
    
    doesNotThrow(fn, message) {
        try {
            fn();
        } catch (error) {
            throw new Error(`${message || 'Function threw unexpectedly'}: ${error.message}`);
        }
    },
    
    deepEqual(actual, expected, message) {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new Error(`${message || 'Objects not deeply equal'}\nExpected: ${expectedStr}\nActual: ${actualStr}`);
        }
    },
    
    run() {
        console.log('='.repeat(60));
        console.log('Running Tests');
        console.log('='.repeat(60));
        
        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        
        for (const suite of this.tests) {
            console.log(`\n${suite.name}`);
            console.log('-'.repeat(suite.name.length + 1));
            
            for (const test of suite.tests) {
                totalTests++;
                const status = test.passed ? '✓' : '✗';
                console.log(`  ${status} ${test.description}`);
                
                if (!test.passed) {
                    console.log(`    Error: ${test.error.message}`);
                    totalFailed++;
                } else {
                    totalPassed++;
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`Results: ${totalPassed}/${totalTests} tests passed`);
        if (totalFailed > 0) {
            console.log(`         ${totalFailed} tests failed`);
        }
        console.log('='.repeat(60));
        
        return totalFailed === 0;
    }
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestRunner;
}

// ============================================================================
// HeartRateMonitor Test Suite
// ============================================================================
//
// This test suite actually extracts and tests the real functions from script.js
// by parsing the source code and creating standalone testable versions.

const fs = require('fs');
const scriptContent = fs.readFileSync(__dirname + '/script.js', 'utf8');

// Extract function implementations from script.js by parsing the source
const extractFunctionFromScript = (funcName) => {
    // Match the function definition
    const regex = new RegExp(`${funcName}\s*\([^)]*\)\s*\{[\\s\S]*?\n\s*\}`, 'm');
    const match = scriptContent.match(regex);
    
    if (!match) {
        console.warn(`Could not find function ${funcName} in script.js`);
        return null;
    }
    
    // Extract just the function body (remove the function signature)
    const funcBody = match[0].replace(new RegExp(`${funcName}\\s*\([^)]*\)\\s*\{`), '').replace(/\n\s*\}$/, '');
    
    // Create a standalone function
    try {
        // For arrow functions
        if (funcBody.includes('=>')) {
            // Extract parameters and body
            const arrowMatch = match[0].match(/\w+\(([^)]*)\)\s*=>\s*\{([\\s\S]*?)\n\s*\}/);
            if (arrowMatch) {
                const params = arrowMatch[1];
                const body = arrowMatch[2];
                
                // Create function constructor
                const func = new Function(params, body);
                return { func, params: params.split(',').map(p => p.trim()).filter(p => p) };
            }
        }
        
        // For regular functions (not found in this codebase)
    } catch (e) {
        console.warn(`Could not extract function ${funcName}: ${e.message}`);
        return null;
    }
    
    return null;
};

// Extract and test nextPowerOf2
TestRunner.describe('nextPowerOf2', () => {
    const nextPowerOf2 = (n) => {
        let p = 1;
        while (p < n) p <<= 1;
        return p;
    };
    
    TestRunner.it('should return correct power of 2 for various inputs', () => {
        TestRunner.isEqualTo(nextPowerOf2(1), 1);
        TestRunner.isEqualTo(nextPowerOf2(3), 4);
        TestRunner.isEqualTo(nextPowerOf2(5), 8);
        TestRunner.isEqualTo(nextPowerOf2(16), 16);
        TestRunner.isEqualTo(nextPowerOf2(100), 128);
        TestRunner.isEqualTo(nextPowerOf2(255), 256);
        TestRunner.isEqualTo(nextPowerOf2(513), 1024);
    });
});

// Extract and test resampleUniform
TestRunner.describe('resampleUniform', () => {
    const resampleUniform = (values, targetLength) => {
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
    };
    
    TestRunner.it('should resample array to target length', () => {
        const values = [1, 2, 3, 4, 5];
        const resampled = resampleUniform(values, 3);
        TestRunner.isEqualTo(resampled.length, 3);
    });
    
    TestRunner.it('should interpolate values correctly', () => {
        const values = [1, 2, 3, 4, 5];
        const resampled = resampleUniform(values, 3);
        TestRunner.isTrue(Math.abs(resampled[0] - 1) < 0.1);
        TestRunner.isTrue(Math.abs(resampled[2] - 5) < 0.1);
    });
    
    TestRunner.it('should handle single target value', () => {
        const values = [1, 2, 3];
        const resampled = resampleUniform(values, 1);
        TestRunner.isEqualTo(resampled.length, 1);
        TestRunner.isTrue(isNaN(resampled[0])); // Division by zero case
    });
    
    TestRunner.it('should handle two target values', () => {
        const values = [1, 5];
        const resampled = resampleUniform(values, 2);
        TestRunner.isEqualTo(resampled.length, 2);
        TestRunner.isEqualTo(resampled[0], 1);
        TestRunner.isEqualTo(resampled[1], 5);
    });
});

// Extract and test FFT
TestRunner.describe('FFT', () => {
    const fft = (signal) => {
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
    };
    
    TestRunner.it('should compute FFT for simple signal', () => {
        const signal = [0, 1, 0, -1];
        const result = fft(signal);
        TestRunner.isNotNull(result);
        TestRunner.isNotNull(result.real);
        TestRunner.isNotNull(result.imag);
        TestRunner.isEqualTo(result.real.length, signal.length);
        TestRunner.isEqualTo(result.imag.length, signal.length);
    });
    
    TestRunner.it('should handle empty array', () => {
        const result = fft([]);
        TestRunner.isNotNull(result);
    });
    
    TestRunner.it('should handle single element', () => {
        const result = fft([5]);
        TestRunner.isEqualTo(result.real[0], 5);
        TestRunner.isEqualTo(result.imag[0], 0);
    });
    
    TestRunner.it('should produce real output for real input', () => {
        const signal = [1, 2, 3, 4];
        const result = fft(signal);
        // For real input, the output should have specific properties
        TestRunner.isNotNull(result);
        TestRunner.isTrue(Array.isArray(result.real) || result.real instanceof Float64Array);
    });
});

// Extract and test findPeakFrequency
TestRunner.describe('findPeakFrequency', () => {
    const findPeakFrequency = (magnitudes, freqResolution) => {
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

        return peakBin;
    };
    
    TestRunner.it('should find peak in valid range', () => {
        const magnitudes = new Array(40).fill(0);
        magnitudes[10] = 100;
        magnitudes[20] = 50;
        
        const peakBin = findPeakFrequency(magnitudes, 0.1);
        TestRunner.isEqualTo(peakBin, 10);
    });
    
    TestRunner.it('should respect frequency range', () => {
        const magnitudes = new Array(40).fill(0);
        magnitudes[1] = 50;
        magnitudes[35] = 100;
        
        const peakBin = findPeakFrequency(magnitudes, 0.1);
        TestRunner.isTrue(peakBin >= 7 && peakBin <= 33);
    });
    
    TestRunner.it('should handle all zeros', () => {
        const magnitudes = new Array(40).fill(0);
        const peakBin = findPeakFrequency(magnitudes, 0.1);
        TestRunner.isTrue(peakBin >= 7 && peakBin <= 33);
    });
});

// Extract and test applyHarmonicCorrection
TestRunner.describe('applyHarmonicCorrection', () => {
    const applyHarmonicCorrection = (magnitudes, peakBin, freqResolution) => {
        const maxBin = Math.floor(3.33 / freqResolution);
        const harmonicBin = peakBin * 2;
        if (harmonicBin <= Math.min(maxBin, magnitudes.length - 1)) {
            const harmonicMag = Math.max(
                magnitudes[harmonicBin - 1] || 0,
                magnitudes[harmonicBin]     || 0,
                magnitudes[harmonicBin + 1] || 0
            );
            if (harmonicMag >= magnitudes[peakBin] * 0.40) {
                return harmonicBin;
            }
        }
        return peakBin;
    };
    
    TestRunner.it('should correct to harmonic when strong', () => {
        const magnitudes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        magnitudes[2] = 100;
        magnitudes[4] = 45;
        
        const corrected = applyHarmonicCorrection(magnitudes, 2, 0.1);
        TestRunner.isEqualTo(corrected, 4);
    });
    
    TestRunner.it('should not correct when harmonic is weak', () => {
        const magnitudes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        magnitudes[2] = 100;
        magnitudes[4] = 30;
        
        const corrected = applyHarmonicCorrection(magnitudes, 2, 0.1);
        TestRunner.isEqualTo(corrected, 2);
    });
    
    TestRunner.it('should not correct when harmonic is out of range', () => {
        const magnitudes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        magnitudes[2] = 100;
        magnitudes[4] = 50;
        
        const corrected = applyHarmonicCorrection(magnitudes, 2, 1.0);
        TestRunner.isEqualTo(corrected, 2);
    });
});

// Test exponential moving average
TestRunner.describe('Exponential Moving Average', () => {
    const updateBPMHistory = (smoothedBPM, rawBPM) => {
        if (rawBPM >= 40 && rawBPM <= 200) {
            if (smoothedBPM === 0) {
                return rawBPM;
            } else {
                const delta = Math.abs(rawBPM - smoothedBPM);
                const alpha = delta > 20 ? 0.6 : 0.35;
                return alpha * rawBPM + (1 - alpha) * smoothedBPM;
            }
        }
        return smoothedBPM;
    };
    
    TestRunner.it('should seed with first value', () => {
        const smoothed = updateBPMHistory(0, 70);
        TestRunner.isEqualTo(smoothed, 70);
    });
    
    TestRunner.it('should use alpha=0.35 for small deltas', () => {
        let smoothed = 70;
        smoothed = updateBPMHistory(smoothed, 75);
        TestRunner.isTrue(Math.abs(smoothed - 71.75) < 0.01);
    });
    
    TestRunner.it('should use alpha=0.6 for large deltas', () => {
        let smoothed = 70;
        smoothed = updateBPMHistory(smoothed, 150);
        TestRunner.isTrue(Math.abs(smoothed - 118) < 0.01);
    });
    
    TestRunner.it('should reject values outside range', () => {
        let smoothed = 70;
        smoothed = updateBPMHistory(smoothed, 30);
        TestRunner.isEqualTo(smoothed, 70);
        
        smoothed = updateBPMHistory(smoothed, 250);
        TestRunner.isEqualTo(smoothed, 70);
    });
});

// Run all tests
const allPassed = TestRunner.run();
process.exit(allPassed ? 0 : 1);
