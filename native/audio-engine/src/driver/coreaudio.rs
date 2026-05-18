//! CoreAudio driver (macOS).
//!
//! Apple's CoreAudio framework provides low-latency audio on macOS and iOS.
//! This driver wraps cpal's CoreAudio host to expose a uniform [`AudioDriver`]
//! interface.
//!
//! On non-macOS platforms this module compiles to stubs that return
//! [`DriverError::NotAvailable`].

#![allow(dead_code)]

use crate::{
    driver::{AudioCallback, AudioDriver, DriverError, Result},
    ipc::protocol::DeviceInfo,
};

// ─────────────────────────────────────────────────────────────────────────────
// CoreAudioDriver
// ─────────────────────────────────────────────────────────────────────────────

/// CoreAudio audio driver.
///
/// On macOS this delegates to a [`CpalDriver`] configured with the CoreAudio
/// host. On other platforms it returns [`DriverError::NotAvailable`].
pub struct CoreAudioDriver {
    sample_rate: u32,
    buffer_size: u32,
    #[cfg(target_os = "macos")]
    inner: crate::driver::CpalDriver,
}

impl CoreAudioDriver {
    /// Create a CoreAudio driver instance.
    pub fn new(sample_rate: u32, buffer_size: u32) -> Self {
        #[cfg(target_os = "macos")]
        {
            Self {
                sample_rate,
                buffer_size,
                inner: crate::driver::CpalDriver::new_with_host_name(
                    "coreaudio",
                    sample_rate,
                    buffer_size,
                ),
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            Self { sample_rate, buffer_size }
        }
    }
}

impl AudioDriver for CoreAudioDriver {
    fn name(&self) -> &str {
        "coreaudio"
    }

    fn start(&mut self, callback: Box<dyn AudioCallback>) -> Result<()> {
        #[cfg(target_os = "macos")]
        {
            self.inner.start(callback)
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = callback;
            Err(DriverError::NotAvailable(
                "CoreAudio is only available on macOS".to_string(),
            ))
        }
    }

    fn stop(&mut self) {
        #[cfg(target_os = "macos")]
        self.inner.stop();
    }

    fn list_devices(&self) -> (Vec<DeviceInfo>, Vec<DeviceInfo>) {
        #[cfg(target_os = "macos")]
        return self.inner.list_devices();
        #[cfg(not(target_os = "macos"))]
        (Vec::new(), Vec::new())
    }

    fn latency_frames(&self) -> u32 {
        #[cfg(target_os = "macos")]
        return self.inner.latency_frames();
        #[cfg(not(target_os = "macos"))]
        0
    }

    fn sample_rate(&self) -> u32 {
        #[cfg(target_os = "macos")]
        return self.inner.sample_rate();
        #[cfg(not(target_os = "macos"))]
        0
    }

    fn buffer_size(&self) -> u32 {
        #[cfg(target_os = "macos")]
        return self.inner.buffer_size();
        #[cfg(not(target_os = "macos"))]
        0
    }
}
