//! Audio buffer types, process context, latency compensation, and plugin chain.

/// Interleaved PCM audio buffer.
#[derive(Debug, Clone)]
pub struct AudioBuffer {
    pub channels: u32,
    pub samples: u32,
    /// Interleaved samples: [L0, R0, L1, R1, …]
    pub data: Vec<f32>,
}

impl AudioBuffer {
    pub fn new(channels: u32, samples: u32) -> Self {
        AudioBuffer {
            channels,
            samples,
            data: vec![0.0f32; (channels * samples) as usize],
        }
    }

    /// Return a non-interleaved channel slice (assumes non-interleaved layout).
    pub fn channel(&self, ch: usize) -> &[f32] {
        let s = self.samples as usize;
        &self.data[ch * s..(ch + 1) * s]
    }

    pub fn channel_mut(&mut self, ch: usize) -> &mut [f32] {
        let s = self.samples as usize;
        &mut self.data[ch * s..(ch + 1) * s]
    }

    /// Mix `other` into `self` with a linear gain factor.
    pub fn mix_from(&mut self, other: &AudioBuffer, gain: f32) {
        for (dst, src) in self.data.iter_mut().zip(other.data.iter()) {
            *dst += src * gain;
        }
    }

    pub fn apply_gain(&mut self, gain: f32) {
        for s in &mut self.data {
            *s *= gain;
        }
    }

    pub fn compute_rms(&self) -> f32 {
        if self.data.is_empty() {
            return 0.0;
        }
        let sum: f32 = self.data.iter().map(|s| s * s).sum();
        (sum / self.data.len() as f32).sqrt()
    }

    pub fn compute_peak(&self) -> f32 {
        self.data.iter().map(|s| s.abs()).fold(0.0f32, f32::max)
    }
}

/// Musical and timing context passed to each plugin on every process call.
#[derive(Debug, Clone)]
pub struct ProcessContext {
    pub sample_rate: f64,
    pub bpm: f64,
    pub bar: u32,
    pub beat: u32,
    pub tick: u32,
    pub ticks_per_beat: u32,
    pub is_playing: bool,
    pub is_recording: bool,
    /// Absolute sample position from project start.
    pub project_time_samples: u64,
    /// Sample position at the start of the current buffer.
    pub cycle_start_samples: u64,
}

/// A simple delay line used for latency compensation.
pub struct LatencyCompensator {
    pub latency_samples: u32,
    buffer: Vec<f32>,
    pos: usize,
}

impl LatencyCompensator {
    pub fn new(latency_samples: u32, _channels: u32) -> Self {
        let size = (latency_samples as usize + 1).max(1);
        LatencyCompensator {
            latency_samples,
            buffer: vec![0.0; size],
            pos: 0,
        }
    }

    pub fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let len = self.buffer.len();
        for (src, dst) in input.iter().zip(output.iter_mut()) {
            let read_pos = (self.pos + 1) % len;
            self.buffer[self.pos] = *src;
            *dst = self.buffer[read_pos];
            self.pos = (self.pos + 1) % len;
        }
    }
}

/// A single plugin slot in a track's processing chain.
pub struct PluginSlot {
    pub instance_id: String,
    pub enabled: bool,
    pub gain_db: f32,
    pub latency_samples: u32,
}

/// Ordered list of plugin slots assigned to one track.
pub struct PluginChain {
    pub track_id: String,
    pub slots: Vec<PluginSlot>,
}

impl PluginChain {
    pub fn new(track_id: String) -> Self {
        PluginChain {
            track_id,
            slots: Vec::new(),
        }
    }

    pub fn add_slot(&mut self, instance_id: String) {
        self.slots.push(PluginSlot {
            instance_id,
            enabled: true,
            gain_db: 0.0,
            latency_samples: 0,
        });
    }

    pub fn remove_slot(&mut self, instance_id: &str) {
        self.slots.retain(|s| s.instance_id != instance_id);
    }

    pub fn total_latency(&self) -> u32 {
        self.slots.iter().map(|s| s.latency_samples).sum()
    }
}

// Re-export PluginProcessor as a type alias so mod.rs can `pub use` it.
pub type PluginProcessor = PluginChain;
