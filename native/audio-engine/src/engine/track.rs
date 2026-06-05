//! Track definitions for the Neurotek Studio audio engine.
//!
//! A [`Track`] represents a single signal path through the mixer. Pre-allocated
//! [`TrackBuffer`]s hold stereo float PCM data for one processing block and are
//! reused every callback to avoid heap allocation in the real-time path.

use crate::engine::automation::AutomationLane;

// ─────────────────────────────────────────────────────────────────────────────
// TrackType
// ─────────────────────────────────────────────────────────────────────────────

/// Classifies a track's role in the signal chain.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackType {
    /// A standard audio track (playback / recording).
    Audio,
    /// A MIDI track (note data only; rendered by plugins).
    Midi,
    /// A submix bus (receives sends from other tracks).
    Bus,
    /// The final master output bus.
    Master,
}

impl TrackType {
    /// Parse a track type from the string sent by the UI.
    pub fn from_str(s: &str) -> Self {
        match s {
            "midi" => Self::Midi,
            "bus" => Self::Bus,
            "master" => Self::Master,
            _ => Self::Audio,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send
// ─────────────────────────────────────────────────────────────────────────────

/// An aux send routing audio from this track to a bus.
#[derive(Debug, Clone)]
pub struct Send {
    /// Destination bus track ID.
    pub to_id: String,
    /// Send level in linear gain (converted from dB at creation).
    pub gain_linear: f32,
    /// Pre-fader: tap signal before the channel fader (true) or after (false).
    pub pre_fader: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Track
// ─────────────────────────────────────────────────────────────────────────────

/// A single track in the project.
#[allow(dead_code)]
#[derive(Debug)]
pub struct Track {
    /// Unique track identifier (matches the UI ID).
    pub id: String,
    /// Display name.
    pub name: String,
    /// Display colour (hex string, e.g. `"#7c3aed"`).
    pub color: String,
    /// Track category.
    pub track_type: TrackType,

    /// Channel fader level in dB.
    pub gain_db: f32,
    /// Pan position: −1.0 = full left, 0.0 = centre, 1.0 = full right.
    pub pan: f32,
    /// Whether the channel is muted.
    pub muted: bool,
    /// Whether the channel is soloed.
    pub soloed: bool,
    /// Whether the channel is armed for recording.
    pub armed: bool,

    /// Reported processing latency in samples (e.g. from plugins).
    pub latency_frames: u32,

    /// Aux sends attached to this track.
    pub sends: Vec<Send>,

    /// Automation lanes for this track's parameters.
    pub automation_lanes: Vec<AutomationLane>,
}

impl Track {
    /// Create a new track with unity gain, centred pan, and no sends.
    pub fn new(id: impl Into<String>, name: impl Into<String>, color: impl Into<String>, track_type: TrackType) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            color: color.into(),
            track_type,
            gain_db: 0.0,
            pan: 0.0,
            muted: false,
            soloed: false,
            armed: false,
            latency_frames: 0,
            sends: Vec::new(),
            automation_lanes: Vec::new(),
        }
    }

    /// Convert the track's `gain_db` to a linear multiplier.
    #[inline]
    pub fn gain_linear(&self) -> f32 {
        db_to_linear(self.gain_db)
    }

    /// Constant-power left gain for the current pan position.
    ///
    /// Uses the equal-power panning law: `cos((pan + 1) * π / 4)`.
    #[inline]
    pub fn pan_gain_left(&self) -> f32 {
        let angle = (self.pan + 1.0) * std::f32::consts::FRAC_PI_4;
        angle.cos()
    }

    /// Constant-power right gain for the current pan position.
    #[inline]
    pub fn pan_gain_right(&self) -> f32 {
        let angle = (self.pan + 1.0) * std::f32::consts::FRAC_PI_4;
        angle.sin()
    }

    /// Add or replace a send to a bus.
    pub fn set_send(&mut self, to_id: impl Into<String>, gain_db: f32, pre_fader: bool) {
        let to_id = to_id.into();
        let gain_linear = db_to_linear(gain_db);
        if let Some(s) = self.sends.iter_mut().find(|s| s.to_id == to_id) {
            s.gain_linear = gain_linear;
            s.pre_fader = pre_fader;
        } else {
            self.sends.push(Send { to_id, gain_linear, pre_fader });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackBuffer
// ─────────────────────────────────────────────────────────────────────────────

/// Pre-allocated stereo PCM buffer for one processing block.
///
/// Allocate once at startup; reuse every audio callback to avoid heap
/// allocation in the real-time path.
pub struct TrackBuffer {
    /// Interleaved stereo samples: [L0, R0, L1, R1, …].
    pub data: Vec<f32>,
    /// Maximum number of stereo frames this buffer can hold.
    pub capacity_frames: usize,
}

impl TrackBuffer {
    /// Allocate a buffer for up to `max_frames` stereo frames.
    pub fn new(max_frames: usize) -> Self {
        Self {
            data: vec![0.0_f32; max_frames * 2],
            capacity_frames: max_frames,
        }
    }

    /// Zero the first `frames` stereo frames in place.
    #[allow(dead_code)]
    #[inline]
    pub fn clear(&mut self, frames: usize) {
        let len = frames.min(self.capacity_frames) * 2;
        self.data[..len].fill(0.0);
    }

    /// Return a mutable slice for `frames` stereo frames.
    #[allow(dead_code)]
    #[inline]
    pub fn as_mut_slice(&mut self, frames: usize) -> &mut [f32] {
        let len = frames.min(self.capacity_frames) * 2;
        &mut self.data[..len]
    }

    /// Return an immutable slice for `frames` stereo frames.
    #[inline]
    pub fn as_slice(&self, frames: usize) -> &[f32] {
        let len = frames.min(self.capacity_frames) * 2;
        &self.data[..len]
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

/// Convert decibels to a linear amplitude multiplier.
///
/// -∞ dB → 0.0, 0 dB → 1.0.
#[inline]
pub fn db_to_linear(db: f32) -> f32 {
    if db <= -96.0 {
        0.0
    } else {
        10.0_f32.powf(db / 20.0)
    }
}

/// Convert a linear amplitude to decibels.
#[inline]
#[allow(dead_code)]
pub fn linear_to_db(linear: f32) -> f32 {
    if linear <= 0.0 {
        -96.0
    } else {
        20.0 * linear.log10()
    }
}
