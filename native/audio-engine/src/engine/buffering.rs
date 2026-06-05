// ─── Smart Buffering System ───────────────────────────────────────────────────
// Adaptive buffering to prevent crackling and handle underruns gracefully
//
// Features:
// - Anti-crackling filters (silence suppression, fade-in/out)
// - Underrun detection and recovery
// - Adaptive buffer sizing
// - Safety margin management

use crate::engine::mixer::LevelMeter;

/// Anti-crackling configuration
#[derive(Debug, Clone, Copy)]
pub struct AntiCracklingConfig {
    /// Enable silence suppression (mute very quiet signals)
    pub silence_suppression: bool,
    /// Silence threshold (-80 dB)
    pub silence_threshold: f32,
    /// Enable fade-in on startup (samples)
    pub fade_in_samples: usize,
    /// Enable fade-out on underrun (samples)
    pub fade_out_samples: usize,
    /// Enable DC-blocking highpass filter
    pub dc_blocking: bool,
}

impl Default for AntiCracklingConfig {
    fn default() -> Self {
        Self {
            silence_suppression: true,
            silence_threshold: -80.0, // dB
            fade_in_samples: 4410,   // 100ms at 44.1kHz
            fade_out_samples: 4410,
            dc_blocking: true,
        }
    }
}

/// Simple DC-blocking highpass filter (very low frequency)
#[derive(Debug, Clone, Copy)]
pub struct DcBlocker {
    /// Previous input sample
    x_prev: f32,
    /// Previous output sample
    y_prev: f32,
    /// Filter coefficient (cutoff ~10Hz at 44.1kHz)
    coeff: f32,
}

impl DcBlocker {
    pub fn new() -> Self {
        // Cutoff at 10Hz: coeff = 1 - 2π×fc/fs
        let coeff = 1.0 - 2.0 * std::f32::consts::PI * 10.0 / 44100.0;
        Self {
            x_prev: 0.0,
            y_prev: 0.0,
            coeff,
        }
    }

    /// Process one sample
    pub fn process(&mut self, x: f32) -> f32 {
        let y = self.coeff * (self.y_prev + x - self.x_prev);
        self.x_prev = x;
        self.y_prev = y;
        y
    }

    /// Process a buffer in-place
    pub fn process_buffer(&mut self, samples: &mut [f32]) {
        for sample in samples {
            *sample = self.process(*sample);
        }
    }
}

/// Adaptive buffer manager
pub struct BufferManager {
    /// Anti-crackling settings
    config: AntiCracklingConfig,
    /// DC blockers per channel
    dc_blockers: Vec<DcBlocker>,
    /// Fade envelope state (0.0 to 1.0)
    fade_envelope: f32,
    /// Fade direction: true=in, false=out
    fade_direction: bool,
    /// Samples to fade
    fade_total: usize,
    /// Current fade sample count
    fade_counter: usize,
    /// Level meter for silence detection
    level_meter: LevelMeter,
    /// Underrun flag
    pub underrun_detected: bool,
    /// Frames since last underrun
    frames_since_underrun: u32,
}

impl BufferManager {
    pub fn new(num_channels: usize) -> Self {
        Self {
            config: AntiCracklingConfig::default(),
            dc_blockers: vec![DcBlocker::new(); num_channels],
            fade_envelope: 1.0,
            fade_direction: true,
            fade_total: 0,
            fade_counter: 0,
            level_meter: LevelMeter::default(),
            underrun_detected: false,
            frames_since_underrun: 0,
        }
    }

    /// Apply anti-crackling filters to output
    pub fn apply_anti_crackling(&mut self, samples: &mut [f32]) {
        // DC blocking filter
        if self.config.dc_blocking {
            for i in 0..samples.len() {
                let ch = i % self.dc_blockers.len();
                samples[i] = self.dc_blockers[ch].process(samples[i]);
            }
        }

        // Silence suppression (noise gate)
        if self.config.silence_suppression {
            self.level_meter.feed(samples);
            let rms = self.level_meter.rms();
            let silence_threshold = db_to_linear(self.config.silence_threshold);

            if rms < silence_threshold {
                // Gate is closed, apply fade-out
                for sample in samples.iter_mut() {
                    *sample *= 0.99; // Smooth fade
                }
                self.level_meter.reset();
            }
        }

        // Fade envelope
        self.apply_fade(samples);
    }

    /// Start fade-in on playback start
    pub fn start_fade_in(&mut self, fade_samples: usize) {
        self.fade_envelope = 0.0;
        self.fade_direction = true;
        self.fade_total = fade_samples;
        self.fade_counter = 0;
    }

    /// Start fade-out on underrun
    pub fn start_fade_out(&mut self, fade_samples: usize) {
        self.fade_envelope = 1.0;
        self.fade_direction = false;
        self.fade_total = fade_samples;
        self.fade_counter = 0;
    }

    /// Apply fade envelope
    fn apply_fade(&mut self, samples: &mut [f32]) {
        if self.fade_total == 0 || self.fade_counter >= self.fade_total {
            if !self.fade_direction {
                self.fade_envelope = 1.0;
            }
            return;
        }

        for sample in samples {
            *sample *= self.fade_envelope;

            if self.fade_direction {
                // Fade in
                self.fade_envelope = (self.fade_counter as f32 / self.fade_total as f32).min(1.0);
            } else {
                // Fade out
                self.fade_envelope = (1.0 - self.fade_counter as f32 / self.fade_total as f32).max(0.0);
            }

            self.fade_counter += 1;
        }
    }

    /// Detect and handle underrun condition
    pub fn handle_underrun(&mut self, frames: usize) {
        self.underrun_detected = true;
        self.frames_since_underrun = 0;

        // Fade out on underrun to prevent clicks
        self.start_fade_out(frames.min(4410)); // Max 100ms fade
    }

    /// Call each block to track recovery
    pub fn on_frame_processed(&mut self) {
        self.frames_since_underrun += 1;

        // After 1 second of good frames, clear underrun flag
        if self.frames_since_underrun > 44100 {
            self.underrun_detected = false;
        }
    }

    /// Check if we should apply extra buffering for stability
    pub fn needs_extra_buffering(&self) -> bool {
        self.underrun_detected || self.frames_since_underrun < 44100
    }

    pub fn set_config(&mut self, config: AntiCracklingConfig) {
        self.config = config;
    }
}

/// Convert dB to linear gain
pub fn db_to_linear(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dc_blocker() {
        let mut blocker = DcBlocker::new();
        let mut samples = vec![1.0; 100];
        blocker.process_buffer(&mut samples);
        // Output should be small due to DC blocking
        assert!(samples[0].abs() < 0.5);
    }

    #[test]
    fn test_buffer_manager() {
        let mut manager = BufferManager::new(2);
        manager.start_fade_in(100);
        let mut samples = vec![1.0; 200];
        manager.apply_anti_crackling(&mut samples);
        // First samples should be faded in (envelope < 1.0)
        assert!(samples[0] < 1.0);
    }
}
