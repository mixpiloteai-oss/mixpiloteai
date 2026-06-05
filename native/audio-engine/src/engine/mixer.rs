//! Mixer — per-channel gain, pan, mute, solo, sends, and master bus limiter.
//!
//! All processing runs on the audio thread with pre-allocated buffers.
//! No heap allocation occurs during [`Mixer::process`].

use crate::engine::track::{db_to_linear, Track, TrackBuffer, TrackType};

// ─────────────────────────────────────────────────────────────────────────────
// ChannelState
// ─────────────────────────────────────────────────────────────────────────────

/// Snapshot of a channel's mixer parameters (used for level reporting).
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct ChannelState {
    pub id: String,
    pub gain_linear: f32,
    pub pan: f32,
    pub muted: bool,
    pub soloed: bool,
    /// True when another track is soloed and this one is silenced as a result.
    pub soloed_by_others: bool,
    pub armed: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// MixerState (snapshot for UI)
// ─────────────────────────────────────────────────────────────────────────────

/// Read-only snapshot of the mixer sent to the UI for metering / state.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct MixerState {
    pub channels: Vec<ChannelState>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Level meter
// ─────────────────────────────────────────────────────────────────────────────

/// Running RMS and peak measurements for a stereo channel.
#[derive(Debug, Default, Clone)]
pub struct LevelMeter {
    /// Accumulated squared sum for RMS calculation.
    rms_accum: f64,
    /// Number of samples accumulated.
    rms_count: u64,
    /// Peak absolute sample value since last reset.
    pub peak: f32,
}

impl LevelMeter {
    /// Feed stereo interleaved samples into the meter.
    pub fn feed(&mut self, samples: &[f32]) {
        for &s in samples {
            let abs = s.abs();
            self.rms_accum += (abs as f64) * (abs as f64);
            self.rms_count += 1;
            if abs > self.peak {
                self.peak = abs;
            }
        }
    }

    /// Compute and reset the RMS value, keeping the peak.
    pub fn rms(&self) -> f32 {
        if self.rms_count == 0 {
            0.0
        } else {
            ((self.rms_accum / self.rms_count as f64).sqrt()) as f32
        }
    }

    /// Reset the accumulator for the next measurement window.
    pub fn reset(&mut self) {
        self.rms_accum = 0.0;
        self.rms_count = 0;
        self.peak = 0.0;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mixer
// ─────────────────────────────────────────────────────────────────────────────

/// The master mixer — owns track-level meters and applies the master gain +
/// soft-knee limiter.
pub struct Mixer {
    /// Master bus gain (linear).
    pub master_gain: f32,
    /// Per-track level meters (indexed parallel to the track list).
    pub track_meters: Vec<(String, LevelMeter)>,
    /// Master bus level meter.
    pub master_meter: LevelMeter,

    // Limiter state
    limiter_gain: f32,
    limiter_threshold: f32,
    limiter_release: f32, // linear per-sample release coefficient
}

impl Mixer {
    /// Create a new mixer with unity master gain.
    pub fn new(sample_rate: u32) -> Self {
        // Release: ~50 ms
        let release_coeff = (-1.0_f32 / (0.05 * sample_rate as f32)).exp();
        Self {
            master_gain: 1.0,
            track_meters: Vec::new(),
            master_meter: LevelMeter::default(),
            limiter_gain: 1.0,
            limiter_threshold: db_to_linear(0.0),  // 0 dBFS
            limiter_release: release_coeff,
        }
    }

    /// Set master gain from a dB value.
    pub fn set_master_gain_db(&mut self, db: f64) {
        self.master_gain = db_to_linear(db as f32);
    }

    /// Ensure a meter exists for the given track ID.
    pub fn ensure_meter(&mut self, id: &str) {
        if !self.track_meters.iter().any(|(mid, _)| mid == id) {
            self.track_meters.push((id.to_string(), LevelMeter::default()));
        }
    }

    /// Remove the meter for a track.
    pub fn remove_meter(&mut self, id: &str) {
        self.track_meters.retain(|(mid, _)| mid != id);
    }

    /// Process one block: apply per-track gain/pan/mute, mix to master bus,
    /// apply master gain and limiter.
    ///
    /// `tracks` and `track_buffers` are parallel slices.
    /// `output` is the interleaved stereo output buffer (2 * frames samples).
    pub fn process(
        &mut self,
        tracks: &[Track],
        track_buffers: &mut [TrackBuffer],
        output: &mut [f32],
        frames: usize,
    ) {
        // Determine whether any track is soloed.
        let any_soloed = tracks.iter().any(|t| t.soloed);

        // Zero master output.
        let out_len = frames * 2;
        output[..out_len].fill(0.0);

        for (i, track) in tracks.iter().enumerate() {
            // Skip bus / master tracks (handled separately).
            if track.track_type == TrackType::Bus || track.track_type == TrackType::Master {
                continue;
            }

            // Silence if muted, or if another track is soloed.
            let silent = track.muted || (any_soloed && !track.soloed);
            if silent {
                continue;
            }

            let gain = track.gain_linear();
            let pan_l = track.pan_gain_left();
            let pan_r = track.pan_gain_right();

            if let Some(buf) = track_buffers.get_mut(i) {
                let src = buf.as_slice(frames);

                // Accumulate into master output and feed level meter.
                let meter = self
                    .track_meters
                    .iter_mut()
                    .find(|(mid, _)| mid == &track.id)
                    .map(|(_, m)| m);

                let out = &mut output[..out_len];
                let mut f = 0;
                let mut s = 0;
                while f < frames && s + 1 < src.len() {
                    let l = src[s] * gain * pan_l;
                    let r = src[s + 1] * gain * pan_r;
                    out[f * 2] += l;
                    out[f * 2 + 1] += r;
                    s += 2;
                    f += 1;
                }

                if let Some(m) = meter {
                    m.feed(src);
                }
            }
        }

        // Apply master gain and soft limiter.
        let master_gain = self.master_gain;
        let threshold = self.limiter_threshold;
        let release = self.limiter_release;
        let mut limiter_gain = self.limiter_gain;

        for chunk in output[..out_len].chunks_exact_mut(2) {
            chunk[0] *= master_gain;
            chunk[1] *= master_gain;

            let peak = chunk[0].abs().max(chunk[1].abs());
            if peak > threshold {
                let desired = threshold / peak;
                if desired < limiter_gain {
                    limiter_gain = desired; // instant attack
                }
            }
            // Release.
            limiter_gain = (limiter_gain * (1.0 / release)).min(1.0).max(0.0);
            limiter_gain = limiter_gain.min(1.0);

            chunk[0] *= limiter_gain;
            chunk[1] *= limiter_gain;
        }

        self.limiter_gain = limiter_gain;
        self.master_meter.feed(&output[..out_len]);
    }

    /// Snapshot the current meter readings and reset accumulators.
    pub fn take_levels(&mut self) -> (Vec<(String, f32, f32)>, (f32, f32)) {
        let track_levels: Vec<_> = self
            .track_meters
            .iter_mut()
            .map(|(id, m)| {
                let rms = m.rms();
                let peak = m.peak;
                m.reset();
                (id.clone(), rms, peak)
            })
            .collect();

        let master_rms = self.master_meter.rms();
        let master_peak = self.master_meter.peak;
        self.master_meter.reset();

        (track_levels, (master_rms, master_peak))
    }

    /// Build a [`MixerState`] snapshot from the current track list.
    #[allow(dead_code)]
    pub fn snapshot(&self, tracks: &[Track]) -> MixerState {
        let any_soloed = tracks.iter().any(|t| t.soloed);
        let channels = tracks
            .iter()
            .map(|t| ChannelState {
                id: t.id.clone(),
                gain_linear: t.gain_linear(),
                pan: t.pan,
                muted: t.muted,
                soloed: t.soloed,
                soloed_by_others: any_soloed && !t.soloed,
                armed: t.armed,
            })
            .collect();
        MixerState { channels }
    }
}
