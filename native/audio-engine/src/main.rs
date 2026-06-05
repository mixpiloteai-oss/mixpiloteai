//! Neurotek Studio — Native Audio Engine
//!
//! Entry point for the audio engine child process. This process is spawned by
//! the Electron main process and communicates with it via newline-delimited
//! JSON messages on stdin/stdout.
//!
//! # Usage
//!
//! ```
//! audio-engine [OPTIONS]
//!
//! Options:
//!   --driver <name>         Audio driver to use (wasapi | coreaudio | asio | default)
//!   --device <id>           Output device identifier
//!   --sample-rate <rate>    Sample rate in Hz (default: 44100)
//!   --buffer-size <frames>  Audio buffer size in frames (default: 512)
//! ```

mod driver;
mod engine;
mod ipc;
mod memory;
mod plugin;
mod realtime;

use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use crossbeam_channel::bounded;
use log::{error, info, warn};
use tokio::sync::mpsc;

use driver::{detect_drivers, AudioCallback};
use engine::{AudioEngine, EngineHandle, SharedState};
use ipc::{
    protocol::{Command, Event},
    run_ipc_loop,
};
use realtime::set_audio_thread_priority;

// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug)]
struct Args {
    driver: String,
    device: String,
    sample_rate: u32,
    buffer_size: u32,
}

impl Default for Args {
    fn default() -> Self {
        Self {
            driver: "default".to_string(),
            device: String::new(),
            sample_rate: 44100,
            buffer_size: 512,
        }
    }
}

fn parse_args() -> Args {
    let mut args = Args::default();
    let raw: Vec<String> = std::env::args().collect();
    let mut i = 1;
    while i < raw.len() {
        match raw[i].as_str() {
            "--driver" => {
                if i + 1 < raw.len() {
                    i += 1;
                    args.driver = raw[i].clone();
                }
            }
            "--device" => {
                if i + 1 < raw.len() {
                    i += 1;
                    args.device = raw[i].clone();
                }
            }
            "--sample-rate" => {
                if i + 1 < raw.len() {
                    i += 1;
                    if let Ok(r) = raw[i].parse::<u32>() {
                        args.sample_rate = r;
                    }
                }
            }
            "--buffer-size" => {
                if i + 1 < raw.len() {
                    i += 1;
                    if let Ok(b) = raw[i].parse::<u32>() {
                        args.buffer_size = b;
                    }
                }
            }
            _ => {}
        }
        i += 1;
    }
    args
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioCallbackImpl — bridges cpal callback to AudioEngine
// ─────────────────────────────────────────────────────────────────────────────

/// Owns the [`AudioEngine`] and implements the real-time audio callback.
struct AudioCallbackImpl {
    engine: AudioEngine,
    /// Used to measure the CPU load of the audio callback.
    last_callback_start: Option<Instant>,
    buffer_duration_secs: f64,
    xrun_count: u32,
}

impl AudioCallbackImpl {
    fn new(engine: AudioEngine, buffer_size: u32, sample_rate: u32) -> Self {
        Self {
            engine,
            last_callback_start: None,
            buffer_duration_secs: buffer_size as f64 / sample_rate as f64,
            xrun_count: 0,
        }
    }
}

impl AudioCallback for AudioCallbackImpl {
    fn process(&mut self, output: &mut [f32], frames: usize) {
        let start = Instant::now();

        // Detect xruns: if this callback was called much later than expected,
        // it means a previous buffer underran.
        if let Some(last) = self.last_callback_start {
            let elapsed = last.elapsed().as_secs_f64();
            // If the gap is > 1.5× the expected buffer duration, it's an xrun.
            if elapsed > self.buffer_duration_secs * 1.5 {
                self.xrun_count += 1;
                self.engine
                    .shared
                    .xrun_count
                    .store(self.xrun_count, std::sync::atomic::Ordering::Relaxed);
            }
        }
        self.last_callback_start = Some(start);

        // Process the audio block.
        self.engine.process_block(output, frames);

        // Update CPU load atomic.
        let elapsed = start.elapsed().as_secs_f64();
        let load = (elapsed / self.buffer_duration_secs) * 100.0;
        self.engine.shared.set_cpu_load(load.min(100.0));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// run_main — separated so the async runtime owns the driver on the same thread
// ─────────────────────────────────────────────────────────────────────────────

/// Main function body — runs entirely on the tokio current-thread executor so
/// that the audio driver (which may be `!Send`) lives on the same OS thread.
async fn run_main(args: Args) {
    // ── Channels ──────────────────────────────────────────────────────────────
    const CMD_CAPACITY: usize = 256;
    let (cmd_tx, cmd_rx) = bounded::<Command>(CMD_CAPACITY);
    let (event_tx_sync, event_rx_sync) = bounded::<Event>(4096);

    // Bridge the sync crossbeam event channel to an async tokio mpsc channel
    // for the IPC writer task.
    let (event_tx_async, event_rx_async) = mpsc::channel::<Event>(4096);

    // Spawn a local task that relays events from the sync channel to the async one.
    let relay_event_tx = event_tx_async.clone();
    let relay_event_rx = event_rx_sync.clone();
    tokio::task::spawn_local(async move {
        loop {
            match relay_event_rx.try_recv() {
                Ok(ev) => {
                    if relay_event_tx.send(ev).await.is_err() {
                        break;
                    }
                }
                Err(crossbeam_channel::TryRecvError::Empty) => {
                    tokio::time::sleep(Duration::from_millis(1)).await;
                }
                Err(crossbeam_channel::TryRecvError::Disconnected) => break,
            }
        }
    });

    // ── Shared state ──────────────────────────────────────────────────────────
    let shared = SharedState::new();
    shared.set_bpm(120.0);

    // ── Audio engine ──────────────────────────────────────────────────────────
    let engine = AudioEngine::new(
        args.sample_rate,
        args.buffer_size as usize,
        cmd_rx,
        event_tx_sync.clone(),
        Arc::clone(&shared),
    );

    // ── Engine handle ─────────────────────────────────────────────────────────
    let handle = EngineHandle::new(
        cmd_tx.clone(),
        Arc::clone(&shared),
        args.sample_rate,
        args.buffer_size,
    );

    // ── Select and start audio driver ─────────────────────────────────────────
    let mut drivers = detect_drivers(args.sample_rate, args.buffer_size);

    let driver_idx = if args.driver == "default" {
        0
    } else {
        drivers
            .iter()
            .position(|d| d.name().to_lowercase() == args.driver.to_lowercase())
            .unwrap_or(0)
    };

    let driver = &mut drivers[driver_idx];
    let driver_name = driver.name().to_string();

    // List devices before starting (while we still have an immutable view).
    let (dev_inputs, dev_outputs) = driver.list_devices();

    // Hint thread priority (best-effort).
    let _priority_thread = std::thread::Builder::new()
        .name("audio-priority-hint".to_string())
        .spawn(set_audio_thread_priority)
        .ok();

    let callback = AudioCallbackImpl::new(engine, args.buffer_size, args.sample_rate);

    match driver.start(Box::new(callback)) {
        Ok(()) => {
            let effective_sr = driver.sample_rate();
            let effective_buf = driver.buffer_size();
            let latency_ms =
                driver.latency_frames() as f64 / effective_sr.max(1) as f64 * 1000.0;

            info!(
                "Driver '{}' started: {}Hz / {} frames / {:.1}ms latency",
                driver_name, effective_sr, effective_buf, latency_ms
            );

            let _ = event_tx_sync.try_send(Event::DriverReady {
                driver: driver_name.clone(),
                sample_rate: effective_sr,
                buffer_size: effective_buf,
                latency_ms,
            });
        }
        Err(e) => {
            error!("Failed to start audio driver '{}': {}", driver_name, e);
            let _ = event_tx_sync.try_send(Event::Error {
                code: "driver_start_failed".to_string(),
                message: e.to_string(),
            });
        }
    }

    let _ = event_tx_sync.try_send(Event::Ready);
    info!("Audio engine ready");

    // ── IPC command dispatcher ────────────────────────────────────────────────
    let (ipc_cmd_tx, mut ipc_cmd_rx) = mpsc::channel::<Command>(256);

    let cmd_tx_clone = cmd_tx.clone();
    let event_tx_sync_clone = event_tx_sync.clone();

    // Save device lists for query responses.
    let cached_inputs = dev_inputs;
    let cached_outputs = dev_outputs;

    tokio::task::spawn_local(async move {
        while let Some(cmd) = ipc_cmd_rx.recv().await {
            match &cmd {
                Command::QueryDevices => {
                    let _ = event_tx_sync_clone.try_send(Event::Devices {
                        inputs: cached_inputs.clone(),
                        outputs: cached_outputs.clone(),
                    });
                }
                Command::GetState => {
                    let _ = event_tx_sync_clone.try_send(handle.state_event());
                }
                Command::Shutdown => {
                    info!("Shutdown command received via IPC");
                    let _ = cmd_tx_clone.try_send(Command::Shutdown);
                    break;
                }
                _ => {
                    if let Err(e) = cmd_tx_clone.try_send(cmd.clone()) {
                        warn!("Command channel full or disconnected: {}", e);
                    }
                }
            }
        }
    });

    // ── IPC loop (blocks until EOF or shutdown) ───────────────────────────────
    let shutdown_notify = Arc::new(tokio::sync::Notify::new());
    let shutdown_clone = Arc::clone(&shutdown_notify);

    run_ipc_loop(ipc_cmd_tx, event_rx_async, shutdown_clone).await;

    // ── Graceful shutdown ─────────────────────────────────────────────────────
    info!("Shutting down audio driver...");
    driver.stop();
    info!("Audio engine shut down cleanly");
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

fn main() {
    // Initialise logging (stderr only — stdout is reserved for IPC).
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .target(env_logger::Target::Stderr)
        .init();

    let args = parse_args();
    info!(
        "Audio engine starting — driver={} device={:?} sr={} buf={}",
        args.driver, args.device, args.sample_rate, args.buffer_size
    );

    // Use a current-thread runtime so the audio driver (potentially `!Send`)
    // stays on the same OS thread as the async executor.
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("failed to build tokio runtime");

    let local = tokio::task::LocalSet::new();
    local.block_on(&rt, run_main(args));
}
