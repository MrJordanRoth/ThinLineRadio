// Copyright (C) 2025 Thinline Dynamic Solutions
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>

package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"math/cmplx"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gonum.org/v1/gonum/dsp/fourier"
)

// Tone represents a detected tone with frequency and timing information
type Tone struct {
	Frequency float64 `json:"frequency"` // Hz
	StartTime float64 `json:"startTime"` // seconds from start of audio
	EndTime   float64 `json:"endTime"`   // seconds from start of audio
	Duration  float64 `json:"duration"`  // seconds
}

// ToneSet represents a configured set of tones for a talkgroup
type ToneSet struct {
	Id          string    `json:"id"`          // Unique identifier
	Label       string    `json:"label"`       // User-friendly name (e.g., "Fire Dept", "EMS")
	ATone       *ToneSpec `json:"aTone"`       // First tone specification (optional)
	BTone       *ToneSpec `json:"bTone"`       // Second tone specification (optional)
	LongTone    *ToneSpec `json:"longTone"`    // Long tone specification (optional)
	Tolerance   float64   `json:"tolerance"`   // Frequency tolerance in Hz (default: ±10Hz)
	MinDuration float64   `json:"minDuration"` // Minimum duration in seconds to be considered valid
}

// ToneSpec defines the expected frequency and duration ranges for a tone
type ToneSpec struct {
	Frequency   float64 `json:"frequency"`   // Expected frequency in Hz
	MinDuration float64 `json:"minDuration"` // Minimum duration in seconds
	MaxDuration float64 `json:"maxDuration"` // Maximum duration in seconds (0 = unlimited)
}

// ToneSequence represents detected tones in a call
type ToneSequence struct {
	Tones           []Tone     `json:"tones"`           // Array of detected tones
	Duration        float64    `json:"duration"`        // Total sequence duration
	ATone           *Tone      `json:"aTone"`           // First tone (if present)
	BTone           *Tone      `json:"bTone"`           // Second tone (if present)
	LongTone        *Tone      `json:"longTone"`        // Extended tone (if present)
	HasTones        bool       `json:"hasTones"`        // Quick flag for filtering
	MatchedToneSet  *ToneSet   `json:"matchedToneSet"`  // Which configured tone set matched the full pattern (if any)
	MatchedToneSets []*ToneSet `json:"matchedToneSets"` // All configured tone sets that matched any detected tone
}

// PendingToneSequence represents tones detected on a call that are waiting to be attached to a subsequent voice call
type PendingToneSequence struct {
	ToneSequence *ToneSequence
	CallId       uint64
	Timestamp    int64 // Unix millisecond timestamp when tones were detected
	SystemId     uint64
	TalkgroupId  uint64
}

// ToneDetector handles tone detection in audio calls
type ToneDetector struct {
	// Configuration
	SampleRate      int     // Audio sample rate (Hz) - typically 8000 or 16000
	WindowSize      int     // FFT window size
	MinToneDuration float64 // Minimum duration to consider a tone valid (seconds)
	FrequencyRange  struct {
		Min float64 // Minimum frequency to detect (Hz)
		Max float64 // Maximum frequency to detect (Hz)
	}
}

// NewToneDetector creates a new tone detector with default settings
func NewToneDetector() *ToneDetector {
	return &ToneDetector{
		SampleRate:      16000, // 16kHz sample rate (can capture up to 8kHz via Nyquist, enough for 0-5000 Hz)
		WindowSize:      2048,  // FFT window size
		MinToneDuration: 0.6,   // Minimum 600ms to be considered a tone
		FrequencyRange: struct {
			Min float64
			Max float64
		}{
			Min: 0.0,    // Can detect from 0 Hz
			Max: 5000.0, // Up to 5000 Hz
		},
	}
}

// Detect analyzes audio for tone patterns using FFT analysis
func (detector *ToneDetector) Detect(audio []byte, audioMime string, toneSets []ToneSet) (*ToneSequence, error) {
	if len(audio) < 1000 {
		return &ToneSequence{Tones: []Tone{}, HasTones: false}, nil
	}

	// Convert audio to WAV PCM format using ffmpeg
	tempDir := os.TempDir()
	srcFile := filepath.Join(tempDir, fmt.Sprintf("tone_src_%d.m4a", time.Now().UnixNano()))
	wavFile := filepath.Join(tempDir, fmt.Sprintf("tone_wav_%d.wav", time.Now().UnixNano()))

	// Write source audio to temp file
	if err := os.WriteFile(srcFile, audio, 0644); err != nil {
		return nil, fmt.Errorf("failed to write temp audio file: %v", err)
	}
	defer os.Remove(srcFile)
	defer os.Remove(wavFile)

	// Convert to WAV 16kHz mono (necessary for 0-5000 Hz tone detection)
	// Need at least 10kHz sample rate to capture 5000 Hz (Nyquist: need 2x max frequency)
	ffArgs := []string{
		"-y", "-loglevel", "error",
		"-i", srcFile,
		"-ar", "16000", // 16kHz sample rate (can capture up to 8kHz via Nyquist, sufficient for 0-5000 Hz)
		"-ac", "1", // Mono
		"-f", "wav",
		wavFile,
	}
	ffCmd := exec.Command("ffmpeg", ffArgs...)
	var ffErr bytes.Buffer
	ffCmd.Stderr = &ffErr
	if err := ffCmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg conversion failed: %v, stderr: %s", err, ffErr.String())
	}

	// Read WAV file
	wavData, err := os.ReadFile(wavFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read WAV file: %v", err)
	}

	// Parse WAV and extract PCM samples
	samples, sampleRate, err := detector.parseWAV(wavData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse WAV: %v", err)
	}

	if len(samples) < 100 {
		return &ToneSequence{Tones: []Tone{}, HasTones: false}, nil
	}

	// Perform FFT analysis to detect tones
	detectedTones := detector.analyzeFrequencies(samples, sampleRate, toneSets)

	// Log tone detection analysis
	fmt.Printf("tone detection: analyzed %d samples at %d Hz, found %d potential tone detections\n", len(samples), sampleRate, len(detectedTones))

	if len(detectedTones) == 0 {
		return &ToneSequence{Tones: []Tone{}, HasTones: false}, nil
	}

	// Build tone sequence
	sequence := &ToneSequence{
		Tones:    detectedTones,
		HasTones: true,
		Duration: float64(len(samples)) / float64(sampleRate),
	}

	// Identify ATone, BTone, LongTone if present
	if len(detectedTones) >= 1 {
		sequence.ATone = &detectedTones[0]
	}
	if len(detectedTones) >= 2 {
		sequence.BTone = &detectedTones[1]
	}
	// Long tones are typically > 3 seconds
	for i := range detectedTones {
		if detectedTones[i].Duration >= 3.0 {
			sequence.LongTone = &detectedTones[i]
			break
		}
	}

	return sequence, nil
}

// parseWAV parses WAV file and returns PCM samples and sample rate
func (detector *ToneDetector) parseWAV(wavData []byte) ([]float64, int, error) {
	if len(wavData) < 44 {
		return nil, 0, fmt.Errorf("WAV file too short")
	}

	// Check for WAV header
	if string(wavData[0:4]) != "RIFF" || string(wavData[8:12]) != "WAVE" {
		return nil, 0, fmt.Errorf("not a valid WAV file")
	}

	// Read sample rate
	sampleRate := int(binary.LittleEndian.Uint32(wavData[24:28]))
	channels := int(binary.LittleEndian.Uint16(wavData[22:24]))
	bitsPerSample := int(binary.LittleEndian.Uint16(wavData[34:36]))

	// Find data chunk
	dataOffset := 44
	for i := 12; i < len(wavData)-8; i++ {
		if string(wavData[i:i+4]) == "data" {
			dataOffset = i + 8
			break
		}
	}

	audioData := wavData[dataOffset:]

	// Convert PCM to float samples
	var samples []float64
	if bitsPerSample == 16 {
		sampleCount := len(audioData) / 2
		samples = make([]float64, sampleCount)
		for i := 0; i < sampleCount; i++ {
			sample := int16(binary.LittleEndian.Uint16(audioData[i*2 : i*2+2]))
			samples[i] = float64(sample) / 32768.0
		}
	} else if bitsPerSample == 8 {
		samples = make([]float64, len(audioData))
		for i := 0; i < len(audioData); i++ {
			samples[i] = (float64(audioData[i]) - 128.0) / 128.0
		}
	} else {
		return nil, 0, fmt.Errorf("unsupported bits per sample: %d", bitsPerSample)
	}

	// Convert stereo to mono if needed
	if channels == 2 {
		monoSamples := make([]float64, len(samples)/2)
		for i := 0; i < len(monoSamples); i++ {
			monoSamples[i] = (samples[i*2] + samples[i*2+1]) / 2.0
		}
		samples = monoSamples
	}

	return samples, sampleRate, nil
}

// analyzeFrequencies performs FFT analysis to detect sustained tones
func (detector *ToneDetector) analyzeFrequencies(samples []float64, sampleRate int, toneSets []ToneSet) []Tone {
	windowSize := 2048     // FFT window size
	hopSize := 512         // Slide window by this much
	minToneDuration := 0.6 // Minimum 600ms to be considered a tone
	toneRange := detector.FrequencyRange

	if toneRange.Min == 0 {
		toneRange.Min = 0.0 // Can detect from 0 Hz
	}
	if toneRange.Max == 0 {
		toneRange.Max = 5000.0 // Up to 5000 Hz
	}

	// Track detected frequencies over time
	type freqDetection struct {
		frequency float64
		startTime float64
		endTime   float64
		magnitude float64
	}

	detections := make(map[int][]freqDetection) // frequency bin -> detections

	// Analyze in sliding windows
	numWindows := (len(samples) - windowSize) / hopSize
	for win := 0; win < numWindows; win++ {
		start := win * hopSize
		end := start + windowSize
		if end > len(samples) {
			break
		}

		window := samples[start:end]
		windowStartTime := float64(start) / float64(sampleRate)
		windowEndTime := float64(end) / float64(sampleRate) // Actual end time of window

		// Apply window function (Hann window) to reduce spectral leakage
		windowed := make([]float64, len(window))
		for i := range window {
			hann := 0.5 * (1.0 - math.Cos(2.0*math.Pi*float64(i)/float64(len(window)-1)))
			windowed[i] = window[i] * hann
		}

		// Perform DFT (Discrete Fourier Transform)
		magnitudes := detector.dft(windowed, sampleRate)

		// Find peaks in tone range
		for bin, mag := range magnitudes {
			freq := float64(bin) * float64(sampleRate) / float64(windowSize)

			// Lower magnitude threshold for better detection sensitivity
			// 0.05 is more sensitive than 0.1 (adjust as needed)
			if freq >= toneRange.Min && freq <= toneRange.Max && mag > 0.05 {
				// Check if this frequency is close to any existing detection (within ±15 Hz) and overlaps in time
				// This prevents creating separate detections for the same tone detected at slightly different frequencies
				found := false
				for freqBin, detectionList := range detections {
					binFreq := float64(freqBin * 10) // Approximate frequency for this bin
					if math.Abs(freq-binFreq) <= 15.0 {
						// Check if any detection in this bin overlaps with current window
						for i := range detectionList {
							// Check if windows overlap (current window overlaps with detection time range)
							if windowStartTime <= detectionList[i].endTime && windowEndTime >= detectionList[i].startTime {
								// Same tone detected - extend the detection
								if windowEndTime > detectionList[i].endTime {
									detectionList[i].endTime = windowEndTime
								}
								if windowStartTime < detectionList[i].startTime {
									detectionList[i].startTime = windowStartTime
								}
								if mag > detectionList[i].magnitude {
									detectionList[i].magnitude = mag
									detectionList[i].frequency = freq // Update to closer frequency
								}
								found = true
								break
							}
						}
						if found {
							break
						}
					}
				}

				if !found {
					// Create new detection - use frequency bin but track actual frequency
					freqBin := int(freq / 10.0)
					if detections[freqBin] == nil {
						detections[freqBin] = []freqDetection{}
					}

					detections[freqBin] = append(detections[freqBin], freqDetection{
						frequency: freq,
						startTime: windowStartTime,
						endTime:   windowEndTime, // Use actual window end time
						magnitude: mag,
					})
				}
			}
		}
	}

	// Merge nearby frequency detections (within ±5 Hz) to avoid duplicate detections of the same tone
	// Group detections by similar frequency and time overlap
	type mergedDetection struct {
		frequency float64 // Average frequency
		startTime float64 // Earliest start
		endTime   float64 // Latest end
		magnitude float64 // Highest magnitude
		count     int     // Number of detections merged
	}

	mergedDetections := []mergedDetection{}

	for _, detectionList := range detections {
		for _, det := range detectionList {
			duration := det.endTime - det.startTime

			if duration >= minToneDuration {
				// Try to merge with existing merged detection
				merged := false
				for i := range mergedDetections {
					md := &mergedDetections[i]
					freqDiff := math.Abs(det.frequency - md.frequency)

					// Only merge if frequencies are within ±15 Hz (tone drift/variation) AND times actually overlap
					// This prevents merging separate tones from different tone sets in stacked tone scenarios
					// For A-tones: typically 300-600 Hz range, ±15 Hz covers drift
					// For B-tones: typically 1000-1200 Hz range, ±15 Hz covers drift
					// We use a small tolerance (0.1s) to handle cases where one tone ends exactly when another starts
					// (could be the same tone with a tiny gap), but we don't merge tones that are clearly separate
					timeOverlap := (det.startTime <= md.endTime+0.1 && det.endTime >= md.startTime-0.1)

					// Only merge if frequencies are close AND times overlap (not just close in time)
					// This prevents merging separate tone sets in stacked tone scenarios
					if freqDiff <= 15.0 && timeOverlap {
						// Merge: use weighted average frequency, extend time range, use max magnitude
						oldFreq := md.frequency
						totalCount := md.count + 1
						md.frequency = (md.frequency*float64(md.count) + det.frequency) / float64(totalCount)
						if det.startTime < md.startTime {
							md.startTime = det.startTime
						}
						if det.endTime > md.endTime {
							md.endTime = det.endTime
						}
						if det.magnitude > md.magnitude {
							md.magnitude = det.magnitude
						}
						md.count = totalCount
						fmt.Printf("merged tone %.1f Hz (%.2fs) with existing %.1f Hz -> %.1f Hz (merged %d detections, time: %.2f-%.2fs)\n",
							det.frequency, det.endTime-det.startTime, oldFreq, md.frequency, totalCount, md.startTime, md.endTime)
						merged = true
						break
					}
				}

				if !merged {
					// Create new merged detection
					mergedDetections = append(mergedDetections, mergedDetection{
						frequency: det.frequency,
						startTime: det.startTime,
						endTime:   det.endTime,
						magnitude: det.magnitude,
						count:     1,
					})
				}
			}
		}
	}

	// Convert merged detections to tones (filter by duration and match against tone sets)
	var tones []Tone
	var allDetections []freqDetection // For logging all detected frequencies (before merging)

	// Log all raw detections for debugging
	for _, detectionList := range detections {
		for _, det := range detectionList {
			if det.endTime-det.startTime >= minToneDuration {
				allDetections = append(allDetections, det)
			}
		}
	}

	// Process merged detections
	for _, md := range mergedDetections {
		duration := md.endTime - md.startTime

		// Check if frequency matches ANY configured tone set (check ALL, don't stop at first match)
		matchedToneSets := []string{} // Track all matches for logging
		matched := false

		for _, toneSet := range toneSets {
			// Determine tolerance: if < 1.0, treat as multiplier for 5 Hz (0.01 = 5 Hz, 0.02 = 10 Hz, etc.); if >= 1.0, treat as absolute Hz
			baseTolerance := toneSet.Tolerance

			// Check ATone
			if toneSet.ATone != nil {
				// Calculate actual tolerance: if ratio (< 1.0), multiply by 500 Hz (0.01 = 5 Hz); if >= 1.0, use as absolute Hz
				actualTolerance := baseTolerance
				if baseTolerance < 1.0 {
					actualTolerance = baseTolerance * 500.0
				}
				freqDiff := math.Abs(md.frequency - toneSet.ATone.Frequency)
				if freqDiff <= actualTolerance && duration >= toneSet.ATone.MinDuration {
					matched = true
					matchInfo := fmt.Sprintf("%s A-tone (%.1f Hz, tol: ±%.1f Hz, diff: %.1f Hz)", toneSet.Label, toneSet.ATone.Frequency, actualTolerance, freqDiff)
					matchedToneSets = append(matchedToneSets, matchInfo)
					// Continue checking other tone sets - DON'T BREAK
				}
			}

			// Check BTone
			if toneSet.BTone != nil {
				// Calculate actual tolerance: if ratio (< 1.0), multiply by 500 Hz (0.01 = 5 Hz); if >= 1.0, use as absolute Hz
				actualTolerance := baseTolerance
				if baseTolerance < 1.0 {
					actualTolerance = baseTolerance * 500.0
				}
				freqDiff := math.Abs(md.frequency - toneSet.BTone.Frequency)
				if freqDiff <= actualTolerance && duration >= toneSet.BTone.MinDuration {
					matched = true
					matchInfo := fmt.Sprintf("%s B-tone (%.1f Hz, tol: ±%.1f Hz, diff: %.1f Hz)", toneSet.Label, toneSet.BTone.Frequency, actualTolerance, freqDiff)
					matchedToneSets = append(matchedToneSets, matchInfo)
					// Continue checking other tone sets - DON'T BREAK
				}
			}

			// Check LongTone
			if toneSet.LongTone != nil {
				// Calculate actual tolerance: if ratio (< 1.0), multiply by 500 Hz (0.01 = 5 Hz); if >= 1.0, use as absolute Hz
				actualTolerance := baseTolerance
				if baseTolerance < 1.0 {
					actualTolerance = baseTolerance * 500.0
				}
				freqDiff := math.Abs(md.frequency - toneSet.LongTone.Frequency)
				if freqDiff <= actualTolerance && duration >= toneSet.LongTone.MinDuration {
					matched = true
					matchInfo := fmt.Sprintf("%s long-tone (%.1f Hz, tol: ±%.1f Hz, diff: %.1f Hz)", toneSet.Label, toneSet.LongTone.Frequency, actualTolerance, freqDiff)
					matchedToneSets = append(matchedToneSets, matchInfo)
					// Continue checking other tone sets - DON'T BREAK
				}
			}
		}

		// Log merged detection (showing merge info if multiple detections were merged)
		if matched {
			if md.count > 1 {
				fmt.Printf("tone matched - %.1f Hz (merged from %d detections) for %.2fs (matched: %s)\n", md.frequency, md.count, duration, strings.Join(matchedToneSets, ", "))
			} else {
				fmt.Printf("tone matched - %.1f Hz for %.2fs (matched: %s)\n", md.frequency, duration, strings.Join(matchedToneSets, ", "))
			}
			tones = append(tones, Tone{
				Frequency: md.frequency,
				StartTime: md.startTime,
				EndTime:   md.endTime,
				Duration:  duration,
			})
		} else {
			// Log what we were looking for vs what was detected
			if md.count > 1 {
				fmt.Printf("tone detected but NO MATCH - %.1f Hz (merged from %d detections) for %.2fs (mag: %.4f)\n", md.frequency, md.count, duration, md.magnitude)
			} else {
				fmt.Printf("tone detected but NO MATCH - %.1f Hz for %.2fs (mag: %.4f)\n", md.frequency, duration, md.magnitude)
			}
			// Show closest configured tones for debugging
			if len(toneSets) > 0 {
				minDiff := 9999.0
				var closestTone string
				for _, ts := range toneSets {
					baseTol := ts.Tolerance
					if ts.ATone != nil {
						actualTol := baseTol
						if baseTol < 1.0 {
							actualTol = ts.ATone.Frequency * baseTol
						}
						diff := math.Abs(md.frequency - ts.ATone.Frequency)
						if diff < minDiff {
							minDiff = diff
							closestTone = fmt.Sprintf("%s A-tone: %.1f Hz (tol: ±%.1f Hz, diff: %.1f Hz)", ts.Label, ts.ATone.Frequency, actualTol, diff)
						}
					}
					if ts.BTone != nil {
						actualTol := baseTol
						if baseTol < 1.0 {
							actualTol = ts.BTone.Frequency * baseTol
						}
						diff := math.Abs(md.frequency - ts.BTone.Frequency)
						if diff < minDiff {
							minDiff = diff
							closestTone = fmt.Sprintf("%s B-tone: %.1f Hz (tol: ±%.1f Hz, diff: %.1f Hz)", ts.Label, ts.BTone.Frequency, actualTol, diff)
						}
					}
					if ts.LongTone != nil {
						actualTol := baseTol
						if baseTol < 1.0 {
							actualTol = ts.LongTone.Frequency * baseTol
						}
						diff := math.Abs(md.frequency - ts.LongTone.Frequency)
						if diff < minDiff {
							minDiff = diff
							closestTone = fmt.Sprintf("%s long-tone: %.1f Hz (tol: ±%.1f Hz, diff: %.1f Hz)", ts.Label, ts.LongTone.Frequency, actualTol, diff)
						}
					}
				}
				if closestTone != "" {
					fmt.Printf("closest configured tone: %s\n", closestTone)
				}
			}
		}
	}

	// Log summary
	if len(allDetections) > 0 {
		fmt.Printf("total detections meeting duration: %d, merged to: %d, matched: %d\n", len(allDetections), len(mergedDetections), len(tones))
		if len(allDetections) != len(mergedDetections) {
			fmt.Printf("DEBUG: merged %d detections into %d (removed %d duplicates)\n", len(allDetections), len(mergedDetections), len(allDetections)-len(mergedDetections))
		}
	} else {
		fmt.Printf("no tones detected meeting minimum duration (%.1fs)\n", minToneDuration)
	}

	return tones
}

// dft performs Fast Fourier Transform (FFT) on real-valued samples
// Returns magnitude spectrum up to Nyquist frequency
// This is O(N log N) complexity, much faster than the previous O(N²) DFT implementation
func (detector *ToneDetector) dft(samples []float64, sampleRate int) map[int]float64 {
	N := len(samples)
	nyquist := sampleRate / 2
	magnitudes := make(map[int]float64)

	// Only compute up to Nyquist frequency
	maxBin := (N * nyquist) / sampleRate

	// Create FFT transformer and compute FFT
	// gonum's NewFFT computes FFT on real input, returns complex coefficients
	fft := fourier.NewFFT(N)
	coeff := fft.Coefficients(nil, samples)

	// Convert complex FFT results to magnitudes
	// Store in map with bin index (matches old DFT interface)
	// Only need first half (up to Nyquist frequency)
	for k := 0; k < maxBin && k < N/2; k++ {
		// FFT gives us complex coefficients, compute magnitude
		// Normalize by N (same as DFT implementation)
		magnitude := cmplx.Abs(coeff[k]) / float64(N)
		magnitudes[k] = magnitude
	}

	return magnitudes
}

// MatchToneSet matches detected tones against configured tone sets and returns the first match
func (detector *ToneDetector) MatchToneSet(detected *ToneSequence, configured []ToneSet) *ToneSet {
	matched := detector.MatchToneSets(detected, configured)
	if len(matched) > 0 {
		return matched[0]
	}
	return nil
}

// MatchToneSets matches detected tones against configured tone sets and returns ALL matches
// This is used for stacked tones where multiple tone sequences may be detected across calls
func (detector *ToneDetector) MatchToneSets(detected *ToneSequence, configured []ToneSet) []*ToneSet {
	if detected == nil || !detected.HasTones || len(configured) == 0 {
		return nil
	}

	var matched []*ToneSet
	for i := range configured {
		toneSet := configured[i]
		if detector.matchesToneSet(detected, toneSet) {
			matched = append(matched, &toneSet)
		}
	}

	return matched
}

// matchesToneSet checks if detected tones match a configured tone set
// Requires that A-tone and B-tone come from the same sequence (A-tone before B-tone)
func (detector *ToneDetector) matchesToneSet(detected *ToneSequence, toneSet ToneSet) bool {
	baseTolerance := toneSet.Tolerance

	// If tone set only has a long tone (no A/B tones), only check for long tone
	if toneSet.LongTone != nil && toneSet.ATone == nil && toneSet.BTone == nil {
		actualTolerance := baseTolerance
		if baseTolerance < 1.0 {
			actualTolerance = baseTolerance * 500.0
		}

		for _, tone := range detected.Tones {
			if detector.frequencyMatches(tone.Frequency, toneSet.LongTone.Frequency, actualTolerance) {
				if tone.Duration >= toneSet.LongTone.MinDuration {
					if toneSet.LongTone.MaxDuration == 0 || tone.Duration <= toneSet.LongTone.MaxDuration {
						// Found matching long tone
						return true
					}
				}
			}
		}
		// No matching long tone found
		return false
	}

	// Find matching A-tone(s) and B-tone(s) with timing
	type matchingTone struct {
		tone      Tone
		matchedAs string // "A" or "B"
	}

	var aTones []matchingTone
	var bTones []matchingTone

	// Find all matching A-tones (only if tone set has A-tone configured)
	if toneSet.ATone != nil {
		actualTolerance := baseTolerance
		if baseTolerance < 1.0 {
			actualTolerance = baseTolerance * 500.0
		}

		for _, tone := range detected.Tones {
			if detector.frequencyMatches(tone.Frequency, toneSet.ATone.Frequency, actualTolerance) {
				if tone.Duration >= toneSet.ATone.MinDuration {
					if toneSet.ATone.MaxDuration == 0 || tone.Duration <= toneSet.ATone.MaxDuration {
						aTones = append(aTones, matchingTone{tone: tone, matchedAs: "A"})
					}
				}
			}
		}
	}

	// Find all matching B-tones (only if tone set has B-tone configured)
	if toneSet.BTone != nil {
		actualTolerance := baseTolerance
		if baseTolerance < 1.0 {
			actualTolerance = baseTolerance * 500.0
		}

		for _, tone := range detected.Tones {
			if detector.frequencyMatches(tone.Frequency, toneSet.BTone.Frequency, actualTolerance) {
				if tone.Duration >= toneSet.BTone.MinDuration {
					if toneSet.BTone.MaxDuration == 0 || tone.Duration <= toneSet.BTone.MaxDuration {
						bTones = append(bTones, matchingTone{tone: tone, matchedAs: "B"})
					}
				}
			}
		}
	}

	// Require A-tone if configured
	if toneSet.ATone != nil && len(aTones) == 0 {
		return false
	}

	// Require B-tone if configured
	if toneSet.BTone != nil && len(bTones) == 0 {
		return false
	}

	// Note: If tone set has A/B tones, we do NOT check for long tones
	// Long tones are only checked if the tone set has NO A/B tones (handled by early return above)

	// If both A-tone and B-tone are required, they must form a valid sequence
	// Each A-tone must be paired with its closest following B-tone (within 0.5s)
	// This prevents false matches where an A-tone pairs with a B-tone from a different tone sequence
	if toneSet.ATone != nil && toneSet.BTone != nil {
		// Sort A-tones by start time to process them in sequence
		aTonesSorted := make([]matchingTone, len(aTones))
		copy(aTonesSorted, aTones)
		sort.Slice(aTonesSorted, func(i, j int) bool {
			return aTonesSorted[i].tone.StartTime < aTonesSorted[j].tone.StartTime
		})

		// Check each A-tone against the tone set's B-tone
		// Each A-tone must find its closest following B-tone that matches this tone set
		for _, aMatch := range aTonesSorted {
			// Find the closest following B-tone within 0.5s gap
			// "Closest" means the smallest gap (either negative for overlap, or positive for sequential)
			var closestB *matchingTone
			var closestGap float64
			hasClosest := false

			for i := range bTones {
				bMatch := &bTones[i]

				// B-tone must end after or when A ends (ensures A comes first in sequence)
				if bMatch.tone.EndTime < aMatch.tone.EndTime {
					continue // B ends before A ends, not a valid sequence
				}

				// Calculate gap (B start time - A end time)
				// Negative = overlapping (B starts before A ends)
				// Positive = sequential (B starts after A ends)
				gap := bMatch.tone.StartTime - aMatch.tone.EndTime

				// Must be within 0.5s gap (either overlap up to 0.5s, or sequential up to 0.5s)
				if gap >= -0.5 && gap <= 0.5 {
					// Check if this is closer than previous closest
					if !hasClosest {
						closestB = bMatch
						closestGap = gap
						hasClosest = true
					} else {
						// Compare absolute gaps - want the one closest to 0
						if math.Abs(gap) < math.Abs(closestGap) {
							closestB = bMatch
							closestGap = gap
						}
					}
				}
			}

			// If we found a closest B-tone, check if it matches this tone set's B-tone frequency
			if closestB != nil {
				// Check if the closest B-tone matches the tone set's B-tone frequency
				actualTolerance := baseTolerance
				if baseTolerance < 1.0 {
					actualTolerance = baseTolerance * 500.0
				}

				if detector.frequencyMatches(closestB.tone.Frequency, toneSet.BTone.Frequency, actualTolerance) {
					// Found a valid A-B pair where A-tone pairs with its closest B-tone
					// and that closest B-tone matches this tone set's B-tone
					return true
				}
			}
		}

		// No valid A-B pair found where A pairs with closest B-tone that matches this tone set
		return false
	}

	return true
}

// frequencyMatches checks if a detected frequency matches an expected frequency within tolerance
func (detector *ToneDetector) frequencyMatches(detected, expected, tolerance float64) bool {
	diff := math.Abs(detected - expected)
	return diff <= tolerance
}

// ParseToneSets parses JSON tone sets from database
func ParseToneSets(jsonData string) ([]ToneSet, error) {
	if jsonData == "" || jsonData == "[]" {
		return []ToneSet{}, nil
	}

	var toneSets []ToneSet
	if err := json.Unmarshal([]byte(jsonData), &toneSets); err != nil {
		return nil, fmt.Errorf("failed to parse tone sets: %v", err)
	}

	return toneSets, nil
}

// SerializeToneSets serializes tone sets to JSON for database storage
func SerializeToneSets(toneSets []ToneSet) (string, error) {
	if len(toneSets) == 0 {
		return "[]", nil
	}

	data, err := json.Marshal(toneSets)
	if err != nil {
		return "", fmt.Errorf("failed to serialize tone sets: %v", err)
	}

	return string(data), nil
}

// SerializeToneSequence serializes a tone sequence to JSON for database storage
func SerializeToneSequence(toneSequence *ToneSequence) (string, error) {
	if toneSequence == nil {
		return "{}", nil
	}

	data, err := json.Marshal(toneSequence)
	if err != nil {
		return "", fmt.Errorf("failed to serialize tone sequence: %v", err)
	}

	return string(data), nil
}
