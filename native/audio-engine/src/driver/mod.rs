//! Audio driver abstraction layer.
//!
//! Defines the [`AudioDriver`] trait and provides concrete implementations for
//! each supported platform backend. Use [`detect_drivers`] to enumerate all
//! drivers available on the current system.

pub mod asio;
pub mod coreaudio;
pub mod wasapi;

use crate::ipc::protocol::DeviceInfo;

// ─────────────────────────────────────────────────────────────────────────────
// AudioCallback trait
// ─────────────────────────────────────────────────────────────────────────────

/// Callback invoked by the audio driver for each processing block.
///
/// Implementations **must** be real-time safe: no allocation, no blocking,
/// no mutex acquisition that could be held by another thread.
pub trait AudioCallback: Send + 'static {
    /// Fill `output` with `frames` stereo interleaved f32 samples.
    fn process(&mut self, output: &mut [f32], frames: usize);
}

// ─────────────────────────────────────────────────────────────────────────────
// DriverError
// ─────────────────────────────────────────────────────────────────────────────

/// Errors that can occur when starting or operating an audio driver.
#[derive(Debug, thiserror::Error)]
pub enum DriverError {
    #[error("driver not available on this platform: {0}")]
    NotAvailable(String),

    #[error("device not found: {0}")]
    DeviceNotFound(String),

    #[error("failed to build stream: {0}")]
    StreamBuild(String),

    #[error("failed to start stream: {0}")]
    StreamStart(String),

    #[allow(dead_code)]
    #[error("unsupported sample format")]
    UnsupportedFormat,

    #[error("internal driver error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, DriverError>;

// ─────────────────────────────────────────────────────────────────────────────
// AudioDriver trait
// ─────────────────────────────────────────────────────────────────────────────

/// A platform audio backend.
///
/// Note: implementations are not required to be `Send` because the cpal
/// `Stream` type is `!Send` on some platforms (e.g. Linux/ALSA). Drivers
/// must be used from the thread that created them.
pub trait AudioDriver {
    /// Human-readable driver name (e.g. `"wasapi"`, `"coreaudio"`, `"asio"`).
    fn name(&self) -> &str;

    /// Start the audio stream, invoking `callback` for each block.
    fn start(&mut self, callback: Box<dyn AudioCallback>) -> Result<()>;

    /// Stop the audio stream.
    fn stop(&mut self);

    /// Enumerate available audio devices.
    fn list_devices(&self) -> (Vec<DeviceInfo>, Vec<DeviceInfo>);

    /// Reported output latency in frames (0 if stream not started).
    fn latency_frames(&self) -> u32;

    /// Current sample rate (0 if stream not started).
    fn sample_rate(&self) -> u32;

    /// Current buffer size in frames (0 if stream not started).
    fn buffer_size(&self) -> u32;
}

// ─────────────────────────────────────────────────────────────────────────────
// CpalDriver — cross-platform driver using cpal
// ─────────────────────────────────────────────────────────────────────────────

use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    Device, Host, Stream, StreamConfig,
};

/// A cross-platform audio driver backed by `cpal`.
pub struct CpalDriver {
    host: Host,
    device_name: String,
    sample_rate: u32,
    buffer_size: u32,
    stream: Option<Stream>,
    current_sample_rate: u32,
    current_buffer_size: u32,
    current_latency: u32,
    driver_name: String,
}

impl CpalDriver {
    /// Create a driver using the default cpal host.
    pub fn new_default(sample_rate: u32, buffer_size: u32) -> Self {
        let host = cpal::default_host();
        Self {
            driver_name: host.id().name().to_string(),
            host,
            device_name: String::new(),
            sample_rate,
            buffer_size,
            stream: None,
            current_sample_rate: 0,
            current_buffer_size: 0,
            current_latency: 0,
        }
    }

    /// Create a driver using a named cpal host (e.g. "WASAPI", "CoreAudio").
    #[allow(dead_code)]
    pub fn new_with_host_name(name: &str, sample_rate: u32, buffer_size: u32) -> Self {
        // Find the host by name (case-insensitive).
        let host = cpal::available_hosts()
            .into_iter()
            .find(|id| id.name().to_lowercase() == name.to_lowercase())
            .and_then(|id| cpal::host_from_id(id).ok())
            .unwrap_or_else(cpal::default_host);

        Self {
            driver_name: name.to_string(),
            host,
            device_name: String::new(),
            sample_rate,
            buffer_size,
            stream: None,
            current_sample_rate: 0,
            current_buffer_size: 0,
            current_latency: 0,
        }
    }

    fn select_device(&self) -> Option<Device> {
        if self.device_name.is_empty() {
            self.host.default_output_device()
        } else {
            self.host
                .output_devices()
                .ok()?
                .find(|d| d.name().ok().as_deref() == Some(&self.device_name))
        }
    }
}

impl AudioDriver for CpalDriver {
    fn name(&self) -> &str {
        &self.driver_name
    }

    fn start(&mut self, mut callback: Box<dyn AudioCallback>) -> Result<()> {
        // Stop any existing stream.
        self.stop();

        let device = self
            .select_device()
            .ok_or_else(|| DriverError::DeviceNotFound(self.device_name.clone()))?;

        let supported_config = device
            .default_output_config()
            .map_err(|e| DriverError::Internal(e.to_string()))?;

        // Prefer the requested sample rate if supported.
        let config = StreamConfig {
            channels: 2,
            sample_rate: cpal::SampleRate(self.sample_rate),
            buffer_size: cpal::BufferSize::Fixed(self.buffer_size),
        };

        // Try the fixed config first; fall back to the default.
        let (effective_config, _format) = if device
            .supported_output_configs()
            .ok()
            .and_then(|mut it| it.find(|c| {
                c.min_sample_rate().0 <= self.sample_rate
                    && c.max_sample_rate().0 >= self.sample_rate
                    && c.channels() == 2
            }))
            .is_some()
        {
            (config, supported_config.sample_format())
        } else {
            let fallback = StreamConfig {
                channels: supported_config.channels(),
                sample_rate: supported_config.sample_rate(),
                buffer_size: cpal::BufferSize::Default,
            };
            (fallback, supported_config.sample_format())
        };

        self.current_sample_rate = effective_config.sample_rate.0;
        self.current_buffer_size = self.buffer_size;

        let err_fn = |e: cpal::StreamError| {
            log::error!("cpal stream error: {}", e);
        };

        // Build the stream.
        let stream = device
            .build_output_stream(
                &effective_config,
                move |data: &mut [f32], _info: &cpal::OutputCallbackInfo| {
                    let frames = data.len() / 2;
                    callback.process(data, frames);
                },
                err_fn,
                None,
            )
            .map_err(|e| DriverError::StreamBuild(e.to_string()))?;

        stream.play().map_err(|e| DriverError::StreamStart(e.to_string()))?;

        // Estimate latency from buffer size.
        self.current_latency = self.buffer_size;
        self.stream = Some(stream);

        log::info!(
            "cpal stream started: {} Hz, {} frames buffer",
            self.current_sample_rate,
            self.current_buffer_size
        );

        Ok(())
    }

    fn stop(&mut self) {
        if let Some(stream) = self.stream.take() {
            drop(stream);
            log::info!("cpal stream stopped");
        }
        self.current_sample_rate = 0;
        self.current_buffer_size = 0;
        self.current_latency = 0;
    }

    fn list_devices(&self) -> (Vec<DeviceInfo>, Vec<DeviceInfo>) {
        let inputs = self
            .host
            .input_devices()
            .map(|devs| {
                devs.filter_map(|d| {
                    let name = d.name().ok()?;
                    Some(DeviceInfo { id: name.clone(), name })
                })
                .collect()
            })
            .unwrap_or_default();

        let outputs = self
            .host
            .output_devices()
            .map(|devs| {
                devs.filter_map(|d| {
                    let name = d.name().ok()?;
                    Some(DeviceInfo { id: name.clone(), name })
                })
                .collect()
            })
            .unwrap_or_default();

        (inputs, outputs)
    }

    fn latency_frames(&self) -> u32 {
        self.current_latency
    }

    fn sample_rate(&self) -> u32 {
        self.current_sample_rate
    }

    fn buffer_size(&self) -> u32 {
        self.current_buffer_size
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// detect_drivers
// ─────────────────────────────────────────────────────────────────────────────

/// Enumerate all audio drivers available on the current system.
///
/// The list is ordered: platform-native drivers first (ASIO on Windows,
/// CoreAudio on macOS), followed by the generic cpal fallback.
pub fn detect_drivers(sample_rate: u32, buffer_size: u32) -> Vec<Box<dyn AudioDriver>> {
    let mut drivers: Vec<Box<dyn AudioDriver>> = Vec::new();

    // Platform-specific drivers.
    #[cfg(target_os = "windows")]
    {
        drivers.push(Box::new(wasapi::WasapiDriver::new(sample_rate, buffer_size)));
        #[cfg(feature = "asio")]
        drivers.push(Box::new(asio::AsioDriver::new(sample_rate, buffer_size)));
    }

    #[cfg(target_os = "macos")]
    {
        drivers.push(Box::new(coreaudio::CoreAudioDriver::new(sample_rate, buffer_size)));
    }

    // Generic cpal fallback (works on Linux/ALSA etc.).
    drivers.push(Box::new(CpalDriver::new_default(sample_rate, buffer_size)));

    drivers
}
