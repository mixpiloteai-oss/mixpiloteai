//! IPC protocol definitions for Neurotek Studio audio engine.
//!
//! Defines all JSON message types exchanged between the Electron UI and
//! the native audio engine child process via stdin/stdout.

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Incoming Commands (UI → Engine)
// ─────────────────────────────────────────────────────────────────────────────

/// A single incoming command from the Electron UI.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum Command {
    /// Start playback.
    Play,

    /// Stop playback and reset to the beginning.
    Stop,

    /// Pause playback at current position.
    Pause,

    /// Seek to a specific bar and beat.
    Seek {
        bar: u32,
        beat: u32,
    },

    /// Set the tempo in beats per minute.
    SetBpm { bpm: f64 },

    /// Set the time signature.
    SetTimeSig { numerator: u32, denominator: u32 },

    /// Configure loop region.
    SetLoop {
        enabled: bool,
        start_bar: u32,
        end_bar: u32,
    },

    /// Add a new track.
    AddTrack {
        id: String,
        #[serde(rename = "type")]
        track_type: String,
        name: String,
        color: String,
    },

    /// Remove a track by ID.
    RemoveTrack { id: String },

    /// Set the gain on a track.
    SetTrackGain { id: String, db: f64 },

    /// Set the pan position on a track (-1.0 left … 1.0 right).
    SetTrackPan { id: String, pan: f64 },

    /// Mute or unmute a track.
    MuteTrack { id: String, muted: bool },

    /// Solo or un-solo a track.
    SoloTrack { id: String, soloed: bool },

    /// Arm or disarm a track for recording.
    ArmTrack { id: String, armed: bool },

    /// Add a send from one channel to another.
    AddSend {
        from_id: String,
        to_id: String,
        gain_db: f64,
        pre_fader: bool,
    },

    /// Set the master bus output gain.
    SetMasterGain { db: f64 },

    /// Switch audio driver and/or output device.
    SetDriver { driver: String, device: String },

    /// Change the audio buffer size in frames.
    SetBufferSize { frames: u32 },

    /// Change the sample rate.
    SetSampleRate { rate: u32 },

    /// Request a list of available audio devices.
    QueryDevices,

    /// Request a snapshot of the full engine state.
    GetState,

    /// Gracefully shut down the engine.
    Shutdown,
}

// ─────────────────────────────────────────────────────────────────────────────
// Outgoing Events (Engine → UI)
// ─────────────────────────────────────────────────────────────────────────────

/// Transport position expressed as bar / beat / tick.
#[derive(Debug, Clone, Serialize)]
pub struct PositionPayload {
    pub bar: u32,
    pub beat: u32,
    pub tick: u32,
}

/// Level meter data for a single channel.
#[derive(Debug, Clone, Serialize)]
pub struct LevelInfo {
    pub id: String,
    pub rms: f64,
    pub peak: f64,
}

/// Master bus level data.
#[derive(Debug, Clone, Serialize)]
pub struct MasterLevel {
    pub rms: f64,
    pub peak: f64,
}

/// Audio device descriptor.
#[derive(Debug, Clone, Serialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
}

/// Audio quality and performance metrics.
#[derive(Debug, Clone, Serialize)]
pub struct AudioDiagnostics {
    pub cpu_load: f32,
    pub peak_level: f32,
    pub rms_level: f32,
    pub clipped_samples: u32,
    pub frame_time_variance: f32,
    pub xrun_count: u32,
}

/// All outgoing events the audio engine can emit.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum Event {
    /// Periodic full-state snapshot.
    State {
        playing: bool,
        recording: bool,
        bpm: f64,
        position: PositionPayload,
        loop_enabled: bool,
    },

    /// Lightweight position tick (sent every audio buffer).
    Position {
        bar: u32,
        beat: u32,
        tick: u32,
    },

    /// CPU usage percentage of the audio thread.
    #[allow(dead_code)]
    CpuLoad { percent: f64 },

    /// Incremented whenever an xrun (buffer underrun/overrun) occurs.
    #[allow(dead_code)]
    Xrun { count: u32 },

    /// Emitted once the driver has started successfully.
    DriverReady {
        driver: String,
        sample_rate: u32,
        buffer_size: u32,
        latency_ms: f64,
    },

    /// Response to `query_devices`.
    Devices {
        inputs: Vec<DeviceInfo>,
        outputs: Vec<DeviceInfo>,
    },

    /// Per-track and master level meters.
    Levels {
        tracks: Vec<LevelInfo>,
        master: MasterLevel,
    },

    /// Audio quality and performance diagnostics.
    #[allow(dead_code)]
    Diagnostics(AudioDiagnostics),

    /// Engine-level error.
    Error { code: String, message: String },

    /// Emitted once on startup after full initialization.
    Ready,
}

impl Event {
    /// Serialize the event to a JSON string terminated by a newline.
    pub fn to_json_line(&self) -> String {
        let mut s = serde_json::to_string(self).unwrap_or_else(|e| {
            format!(r#"{{"event":"error","code":"serialize","message":"{}"}}"#, e)
        });
        s.push('\n');
        s
    }
}

/// Parse a JSON line from stdin into a [`Command`].
pub fn parse_command(line: &str) -> Result<Command, serde_json::Error> {
    serde_json::from_str(line.trim())
}
