// ─── Audio Profiler ───────────────────────────────────────────────────────────
// Real-time audio performance monitoring and diagnostics
//
// Tracks:
// - CPU load per callback
// - Buffer timing and stability
// - Xrun detection and prevention
// - Audio quality metrics (clipping, distortion)
// - Latency compensation

use std::collections::VecDeque;
use std::time::Instant;

/// Audio quality measurements
#[derive(Debug, Clone, Copy, Default)]
pub struct AudioMetrics {
    /// CPU load (0-100)
    pub cpu_load: f32,
    /// Peak sample value since last reset
    pub peak_level: f32,
    /// RMS level estimate
    pub rms_level: f32,
    /// Number of samples that clipped (>1.0 or <-1.0)
    pub clipped_samples: u32,
    /// Frame time variance (instability metric)
    pub frame_time_variance: f32,
}

/// Latency compensation configuration
#[derive(Debug, Clone, Copy)]
pub struct LatencyConfig {
    /// Input-to-output latency in frames
    pub total_latency_frames: u32,
    /// Compensate for latency in automation/MIDI
    pub enable_compensation: bool,
    /// Pre-compensation lookahead buffer (frames)
    pub lookahead_frames: u32,
}

impl Default for LatencyConfig {
    fn default() -> Self {
        Self {
            total_latency_frames: 512,
            enable_compensation: true,
            lookahead_frames: 512,
        }
    }
}

/// Real-time audio profiler
pub struct AudioProfiler {
    /// Recent CPU loads (samples)
    cpu_loads: VecDeque<f32>,
    /// Recent frame times (nanoseconds)
    frame_times: VecDeque<u64>,
    /// Xrun history (count, severity)
    xrun_history: Vec<(u32, f32)>,
    /// Latency compensation
    latency: LatencyConfig,
    /// Last callback timestamp
    last_callback_time: Option<Instant>,
    /// Expected frame duration (nanoseconds)
    expected_frame_ns: u64,
    /// Current audio metrics
    current_metrics: AudioMetrics,
    /// Peak CPU load observed
    peak_cpu_load: f32,
    /// Number of frames processed
    frames_processed: u64,
}

impl AudioProfiler {
    pub fn new(sample_rate: u32, buffer_size: u32) -> Self {
        let expected_frame_ns = (buffer_size as f64 / sample_rate as f64 * 1e9) as u64;

        Self {
            cpu_loads: VecDeque::with_capacity(100),
            frame_times: VecDeque::with_capacity(100),
            xrun_history: Vec::new(),
            latency: LatencyConfig::default(),
            last_callback_time: None,
            expected_frame_ns,
            current_metrics: AudioMetrics::default(),
            peak_cpu_load: 0.0,
            frames_processed: 0,
        }
    }

    /// Record callback timing and detect xruns
    pub fn on_callback_start(&mut self) -> u32 {
        let now = Instant::now();
        let mut xrun_severity = 0u32;

        if let Some(last) = self.last_callback_time {
            let elapsed_ns = last.elapsed().as_nanos() as u64;
            let ratio = elapsed_ns as f32 / self.expected_frame_ns as f32;

            self.frame_times.push_back(elapsed_ns);
            if self.frame_times.len() > 100 {
                self.frame_times.pop_front();
            }

            // Detect xruns: if callback took >1.5× expected time, it's late
            if ratio > 1.5 {
                xrun_severity = (ratio * 100.0) as u32;
                self.xrun_history.push((xrun_severity, ratio));
                if self.xrun_history.len() > 100 {
                    self.xrun_history.remove(0);
                }
            }
        }

        self.last_callback_time = Some(now);
        xrun_severity
    }

    /// Record callback completion and CPU load
    pub fn on_callback_end(&mut self, cpu_load: f32) {
        self.cpu_loads.push_back(cpu_load);
        if self.cpu_loads.len() > 100 {
            self.cpu_loads.pop_front();
        }

        if cpu_load > self.peak_cpu_load {
            self.peak_cpu_load = cpu_load;
        }

        self.frames_processed += 1;
    }

    /// Analyze audio buffer for clipping and levels
    pub fn analyze_audio(&mut self, samples: &[f32]) {
        let mut peak = 0.0f32;
        let mut rms = 0.0f64;
        let mut clipped = 0u32;

        for &sample in samples {
            let abs = sample.abs();
            if abs > peak {
                peak = abs;
            }
            if abs > 1.0 {
                clipped += 1;
            }
            rms += (abs as f64) * (abs as f64);
        }

        rms = (rms / samples.len() as f64).sqrt();

        self.current_metrics.peak_level = peak;
        self.current_metrics.rms_level = rms as f32;
        self.current_metrics.clipped_samples = clipped;
    }

    /// Update frame time variance (stability metric)
    pub fn update_stability(&mut self) {
        if self.frame_times.len() < 2 {
            self.current_metrics.frame_time_variance = 0.0;
            return;
        }

        let mean = self.frame_times.iter().sum::<u64>() as f32 / self.frame_times.len() as f32;
        let variance: f32 = self
            .frame_times
            .iter()
            .map(|&t| {
                let diff = t as f32 - mean;
                diff * diff
            })
            .sum::<f32>()
            / self.frame_times.len() as f32;

        self.current_metrics.frame_time_variance = variance.sqrt() / mean * 100.0; // CV%
    }

    /// Update CPU load metric
    pub fn update_cpu_load(&mut self) {
        if self.cpu_loads.is_empty() {
            self.current_metrics.cpu_load = 0.0;
            return;
        }

        let avg: f32 = self.cpu_loads.iter().sum::<f32>() / self.cpu_loads.len() as f32;
        self.current_metrics.cpu_load = avg;
    }

    /// Get current audio metrics
    pub fn metrics(&self) -> &AudioMetrics {
        &self.current_metrics
    }

    /// Check if audio quality is degrading
    pub fn is_degraded(&self) -> bool {
        self.current_metrics.cpu_load > 90.0
            || self.current_metrics.frame_time_variance > 5.0 // >5% jitter
            || self.current_metrics.clipped_samples > 0
    }

    /// Get diagnostic report
    pub fn diagnostic_report(&self) -> String {
        let avg_cpu = if self.cpu_loads.is_empty() {
            0.0
        } else {
            self.cpu_loads.iter().sum::<f32>() / self.cpu_loads.len() as f32
        };

        let xrun_count = self.xrun_history.len();
        let last_xrun_severity = self.xrun_history.last().map(|(s, _)| *s).unwrap_or(0);

        format!(
            "Audio Diagnostics:\n  CPU Load: {:.1}% (peak: {:.1}%)\n  Xruns: {} (last: {}%)\n  Frame Time Variance: {:.2}%\n  Clipping: {} samples\n  Peak Level: {:.3}\n  RMS Level: {:.3}",
            avg_cpu,
            self.peak_cpu_load,
            xrun_count,
            last_xrun_severity,
            self.current_metrics.frame_time_variance,
            self.current_metrics.clipped_samples,
            self.current_metrics.peak_level,
            self.current_metrics.rms_level
        )
    }

    /// Set latency compensation
    pub fn set_latency(&mut self, total_frames: u32, lookahead: u32) {
        self.latency.total_latency_frames = total_frames;
        self.latency.lookahead_frames = lookahead;
    }

    pub fn latency(&self) -> &LatencyConfig {
        &self.latency
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_profiler_creation() {
        let profiler = AudioProfiler::new(44100, 512);
        assert_eq!(profiler.frames_processed, 0);
    }
}
