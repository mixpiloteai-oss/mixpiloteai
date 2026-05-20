//! Core audio engine module.
//!
//! Owns the [`AudioEngine`] struct which coordinates the transport, mixer,
//! audio graph, and shared atomic state. Command dispatch and the real-time
//! audio callback both operate through this module.

pub mod automation;
pub mod buffering;
pub mod graph;
pub mod mixer;
pub mod profiler;
pub mod track;
pub mod transport;

use std::sync::{
    atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering},
    Arc,
};

use crossbeam_channel::{Receiver, Sender, TryRecvError};
use log::{debug, info, warn};
use parking_lot::Mutex;

use crate::{
    engine::{
        buffering::BufferManager,
        mixer::Mixer,
        profiler::AudioProfiler,
        track::{Track, TrackBuffer, TrackType},
        transport::Transport,
    },
    ipc::protocol::{Command, DeviceInfo, Event, LevelInfo, MasterLevel, PositionPayload},
};

// ─────────────────────────────────────────────────────────────────────────────
// SharedState
// ─────────────────────────────────────────────────────────────────────────────

/// Lock-free values shared between the audio thread and the IPC thread.
///
/// All fields are atomics so the IPC thread can read them without locking.
pub struct SharedState {
    /// Whether playback is running.
    pub playing: AtomicBool,
    /// Whether recording is active.
    pub recording: AtomicBool,
    /// BPM stored as the bit-pattern of an f64.
    pub bpm_bits: AtomicU64,
    /// Current sample position.
    pub sample_pos: AtomicU64,
    /// CPU load of the audio thread (0–100), stored as f64 bits.
    pub cpu_load_bits: AtomicU64,
    /// Cumulative xrun count.
    pub xrun_count: AtomicU32,
    /// Whether loop playback is engaged.
    pub loop_enabled: AtomicBool,
}

impl SharedState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            playing: AtomicBool::new(false),
            recording: AtomicBool::new(false),
            bpm_bits: AtomicU64::new(120.0_f64.to_bits()),
            sample_pos: AtomicU64::new(0),
            cpu_load_bits: AtomicU64::new(0),
            xrun_count: AtomicU32::new(0),
            loop_enabled: AtomicBool::new(false),
        })
    }

    pub fn bpm(&self) -> f64 {
        f64::from_bits(self.bpm_bits.load(Ordering::Relaxed))
    }

    pub fn set_bpm(&self, bpm: f64) {
        self.bpm_bits.store(bpm.to_bits(), Ordering::Relaxed);
    }

    #[allow(dead_code)]
    pub fn cpu_load(&self) -> f64 {
        f64::from_bits(self.cpu_load_bits.load(Ordering::Relaxed))
    }

    pub fn set_cpu_load(&self, load: f64) {
        self.cpu_load_bits.store(load.to_bits(), Ordering::Relaxed);
    }
}

impl Default for SharedState {
    fn default() -> Self {
        Self {
            playing: AtomicBool::new(false),
            recording: AtomicBool::new(false),
            bpm_bits: AtomicU64::new(120.0_f64.to_bits()),
            sample_pos: AtomicU64::new(0),
            cpu_load_bits: AtomicU64::new(0),
            xrun_count: AtomicU32::new(0),
            loop_enabled: AtomicBool::new(false),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioEngine
// ─────────────────────────────────────────────────────────────────────────────

/// The main audio engine.
///
/// `AudioEngine` lives in the audio thread and processes one block of audio
/// per callback invocation. It receives commands from the IPC thread via a
/// lock-free channel and writes events back through a separate channel.
pub struct AudioEngine {
    // Core state
    transport: Transport,
    mixer: Mixer,
    tracks: Vec<Track>,
    track_buffers: Vec<TrackBuffer>,

    // Output buffer
    output_buffer: Vec<f32>,

    // Parameters
    sample_rate: u32,
    max_frames: usize,

    // Level reporting
    level_report_counter: u32,
    /// How many blocks between level snapshots (approx. 10 fps at 512 frames / 44100 Hz).
    level_report_interval: u32,

    // Profiling and monitoring
    profiler: AudioProfiler,
    buffer_manager: BufferManager,

    // Channels
    cmd_rx: Receiver<Command>,
    event_tx: Sender<Event>,

    // Shared atomics (read by IPC thread)
    pub shared: Arc<SharedState>,
}

impl AudioEngine {
    /// Create a new engine. Does not start audio.
    ///
    /// `max_frames` is the maximum buffer size in frames; pre-allocates all
    /// internal buffers at this size.
    pub fn new(
        sample_rate: u32,
        max_frames: usize,
        cmd_rx: Receiver<Command>,
        event_tx: Sender<Event>,
        shared: Arc<SharedState>,
    ) -> Self {
        let report_interval = (sample_rate as f64 / max_frames as f64 / 10.0).max(1.0) as u32;

        Self {
            transport: Transport::new(sample_rate),
            mixer: Mixer::new(sample_rate),
            tracks: Vec::new(),
            track_buffers: Vec::new(),
            output_buffer: vec![0.0_f32; max_frames * 2],
            sample_rate,
            max_frames,
            level_report_counter: 0,
            level_report_interval: report_interval,
            profiler: AudioProfiler::new(sample_rate, max_frames as u32),
            buffer_manager: BufferManager::new(2), // Stereo
            cmd_rx,
            event_tx,
            shared,
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Audio callback entry point
    // ─────────────────────────────────────────────────────────────────────────

    /// Process one audio block.
    ///
    /// Called from the real-time audio thread. Must never allocate or block.
    ///
    /// `output` is an interleaved stereo float buffer (2 × frames samples).
    pub fn process_block(&mut self, output: &mut [f32], frames: usize) {
        // Start profiling this callback
        let xrun_severity = self.profiler.on_callback_start();
        if xrun_severity > 0 {
            warn!("Xrun detected (severity: {}%)", xrun_severity);
            self.buffer_manager.handle_underrun(frames);
        }

        // Drain pending commands (non-blocking).
        self.drain_commands();

        // Advance transport.
        self.transport.advance(frames);

        // Update shared sample position.
        self.shared
            .sample_pos
            .store(self.transport.sample_position, Ordering::Relaxed);

        // Run mixer.
        let out_len = frames * 2;
        self.output_buffer[..out_len].fill(0.0);
        self.mixer.process(
            &self.tracks,
            &mut self.track_buffers,
            &mut self.output_buffer[..out_len],
            frames,
        );

        // Analyze audio for quality metrics (clipping, levels)
        self.profiler.analyze_audio(&self.output_buffer[..out_len]);

        // Apply anti-crackling measures
        self.buffer_manager.apply_anti_crackling(&mut self.output_buffer[..out_len]);

        // Copy to driver output.
        output[..out_len].copy_from_slice(&self.output_buffer[..out_len]);

        // Track buffer manager state
        self.buffer_manager.on_frame_processed();

        // Update stability metrics
        self.profiler.update_stability();
        self.profiler.update_cpu_load();

        // Finish profiling
        let cpu_load = self.shared.cpu_load();
        self.profiler.on_callback_end(cpu_load as f32);

        // Periodic level report.
        self.level_report_counter += 1;
        if self.level_report_counter >= self.level_report_interval {
            self.level_report_counter = 0;
            self.emit_levels();
            self.emit_position();

            // Also emit audio quality diagnostics periodically
            if self.profiler.is_degraded() {
                debug!("{}", self.profiler.diagnostic_report());
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Command dispatch (called from audio thread via try_recv)
    // ─────────────────────────────────────────────────────────────────────────

    fn drain_commands(&mut self) {
        loop {
            match self.cmd_rx.try_recv() {
                Ok(cmd) => self.handle_command(cmd),
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => break,
            }
        }
    }

    fn handle_command(&mut self, cmd: Command) {
        match cmd {
            Command::Play => {
                self.transport.playing = true;
                self.shared.playing.store(true, Ordering::Relaxed);
                debug!("Transport: play");
            }
            Command::Stop => {
                self.transport.playing = false;
                self.transport.sample_position = 0;
                self.shared.playing.store(false, Ordering::Relaxed);
                self.shared.sample_pos.store(0, Ordering::Relaxed);
                debug!("Transport: stop");
            }
            Command::Pause => {
                self.transport.playing = false;
                self.shared.playing.store(false, Ordering::Relaxed);
                debug!("Transport: pause");
            }
            Command::Seek { bar, beat } => {
                self.transport.seek_to(bar, beat);
                self.shared
                    .sample_pos
                    .store(self.transport.sample_position, Ordering::Relaxed);
            }
            Command::SetBpm { bpm } => {
                if bpm > 0.0 && bpm < 999.0 {
                    self.transport.bpm = bpm;
                    self.shared.set_bpm(bpm);
                }
            }
            Command::SetTimeSig { numerator, denominator } => {
                if numerator > 0 && denominator > 0 {
                    self.transport.time_sig.numerator = numerator;
                    self.transport.time_sig.denominator = denominator;
                }
            }
            Command::SetLoop { enabled, start_bar, end_bar } => {
                self.transport.looping = enabled;
                self.transport.loop_start_bar = start_bar;
                self.transport.loop_end_bar = end_bar;
                self.shared.loop_enabled.store(enabled, Ordering::Relaxed);
            }
            Command::AddTrack { id, track_type, name, color } => {
                if !self.tracks.iter().any(|t| t.id == id) {
                    let ty = TrackType::from_str(&track_type);
                    self.tracks.push(Track::new(&id, name, color, ty));
                    self.track_buffers.push(TrackBuffer::new(self.max_frames));
                    self.mixer.ensure_meter(&id);
                    info!("Added track: {}", id);
                }
            }
            Command::RemoveTrack { id } => {
                if let Some(pos) = self.tracks.iter().position(|t| t.id == id) {
                    self.tracks.remove(pos);
                    self.track_buffers.remove(pos);
                    self.mixer.remove_meter(&id);
                    info!("Removed track: {}", id);
                }
            }
            Command::SetTrackGain { id, db } => {
                if let Some(t) = self.tracks.iter_mut().find(|t| t.id == id) {
                    t.gain_db = db as f32;
                }
            }
            Command::SetTrackPan { id, pan } => {
                if let Some(t) = self.tracks.iter_mut().find(|t| t.id == id) {
                    t.pan = (pan as f32).clamp(-1.0, 1.0);
                }
            }
            Command::MuteTrack { id, muted } => {
                if let Some(t) = self.tracks.iter_mut().find(|t| t.id == id) {
                    t.muted = muted;
                }
            }
            Command::SoloTrack { id, soloed } => {
                if let Some(t) = self.tracks.iter_mut().find(|t| t.id == id) {
                    t.soloed = soloed;
                }
            }
            Command::ArmTrack { id, armed } => {
                if let Some(t) = self.tracks.iter_mut().find(|t| t.id == id) {
                    t.armed = armed;
                }
            }
            Command::AddSend { from_id, to_id, gain_db, pre_fader } => {
                if let Some(t) = self.tracks.iter_mut().find(|t| t.id == from_id) {
                    t.set_send(to_id, gain_db as f32, pre_fader);
                }
            }
            Command::SetMasterGain { db } => {
                self.mixer.set_master_gain_db(db);
            }
            Command::SetBufferSize { frames } => {
                // Resize will be handled at driver level; update internal max.
                let new_max = frames as usize;
                if new_max != self.max_frames {
                    self.max_frames = new_max;
                    self.output_buffer.resize(new_max * 2, 0.0);
                    for buf in &mut self.track_buffers {
                        *buf = TrackBuffer::new(new_max);
                    }
                }
            }
            Command::SetSampleRate { rate } => {
                self.sample_rate = rate;
                self.transport.sample_rate = rate;
            }
            Command::GetState => {
                self.emit_state();
            }
            // Driver/device commands are handled by the IPC thread, not here.
            Command::SetDriver { .. }
            | Command::QueryDevices
            | Command::Shutdown => {
                warn!("Command {:?} reached audio engine — ignoring", cmd);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Event emission helpers (lock-free sends)
    // ─────────────────────────────────────────────────────────────────────────

    fn emit_state(&self) {
        let pos = self.transport.position();
        let _ = self.event_tx.try_send(Event::State {
            playing: self.transport.playing,
            recording: self.transport.recording,
            bpm: self.transport.bpm,
            position: PositionPayload {
                bar: pos.bar,
                beat: pos.beat,
                tick: pos.tick,
            },
            loop_enabled: self.transport.looping,
        });
    }

    fn emit_position(&self) {
        let pos = self.transport.position();
        let _ = self.event_tx.try_send(Event::Position {
            bar: pos.bar,
            beat: pos.beat,
            tick: pos.tick,
        });
    }

    fn emit_levels(&mut self) {
        let (track_levels, (master_rms, master_peak)) = self.mixer.take_levels();
        let tracks: Vec<LevelInfo> = track_levels
            .into_iter()
            .map(|(id, rms, peak)| LevelInfo {
                id,
                rms: rms as f64,
                peak: peak as f64,
            })
            .collect();
        let _ = self.event_tx.try_send(Event::Levels {
            tracks,
            master: MasterLevel {
                rms: master_rms as f64,
                peak: master_peak as f64,
            },
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EngineHandle — the thread-safe handle owned by the IPC dispatcher
// ─────────────────────────────────────────────────────────────────────────────

/// Thread-safe handle to engine state, used by the IPC thread for commands
/// that need to interact with the engine outside the audio callback
/// (e.g. device queries, driver switching).
#[allow(dead_code)]
#[derive(Clone)]
pub struct EngineHandle {
    pub cmd_tx: crossbeam_channel::Sender<Command>,
    pub shared: Arc<SharedState>,
    /// Mutex-protected state for the rare operations that need it.
    pub mutable: Arc<Mutex<EngineHandleMutable>>,
}

/// State inside [`EngineHandle`] that needs mutex protection.
#[allow(dead_code)]
pub struct EngineHandleMutable {
    pub sample_rate: u32,
    pub buffer_size: u32,
    pub driver_name: String,
}

impl EngineHandle {
    pub fn new(
        cmd_tx: crossbeam_channel::Sender<Command>,
        shared: Arc<SharedState>,
        sample_rate: u32,
        buffer_size: u32,
    ) -> Self {
        Self {
            cmd_tx,
            shared,
            mutable: Arc::new(Mutex::new(EngineHandleMutable {
                sample_rate,
                buffer_size,
                driver_name: "default".to_string(),
            })),
        }
    }

    /// Send a command to the audio engine (non-blocking).
    #[allow(dead_code)]
    pub fn send_command(&self, cmd: Command) -> Result<(), crossbeam_channel::SendError<Command>> {
        self.cmd_tx.try_send(cmd).map_err(|e| match e {
            crossbeam_channel::TrySendError::Full(c) => crossbeam_channel::SendError(c),
            crossbeam_channel::TrySendError::Disconnected(c) => crossbeam_channel::SendError(c),
        })
    }

    /// Build a full state event from atomics (cheap, no lock).
    pub fn state_event(&self) -> Event {
        let sample_rate = {
            let m = self.mutable.lock();
            m.sample_rate
        };
        let sample_pos = self.shared.sample_pos.load(Ordering::Relaxed);
        let bpm = self.shared.bpm();
        // Derive transport position from sample_pos and bpm.
        let spb = (60.0 / bpm) * sample_rate as f64;
        let total_beats = if spb > 0.0 { sample_pos as f64 / spb } else { 0.0 };
        let beats_int = total_beats as u64;
        let bar = (beats_int / 4) as u32 + 1;
        let beat = (beats_int % 4) as u32 + 1;
        let tick = ((total_beats - beats_int as f64) * transport::TICKS_PER_BEAT as f64) as u32;

        Event::State {
            playing: self.shared.playing.load(Ordering::Relaxed),
            recording: self.shared.recording.load(Ordering::Relaxed),
            bpm,
            position: PositionPayload { bar, beat, tick },
            loop_enabled: self.shared.loop_enabled.load(Ordering::Relaxed),
        }
    }

    /// Build a `devices` event by querying the active driver.
    #[allow(dead_code)]
    pub fn devices_event(inputs: Vec<DeviceInfo>, outputs: Vec<DeviceInfo>) -> Event {
        Event::Devices { inputs, outputs }
    }
}
