//! WASAPI audio driver (Windows).
//!
//! Windows Audio Session API (WASAPI) provides low-latency audio on Windows
//! Vista and later. This driver wraps cpal's WASAPI host to expose a uniform
//! [`AudioDriver`] interface.
//!
//! On non-Windows platforms this module compiles to stubs that return
//! [`DriverError::NotAvailable`].

#![allow(dead_code)]

use crate::{
    driver::{AudioCallback, AudioDriver, DriverError, Result},
    ipc::protocol::DeviceInfo,
};

// ─────────────────────────────────────────────────────────────────────────────
// WasapiDriver
// ─────────────────────────────────────────────────────────────────────────────

/// WASAPI audio driver.
///
/// On Windows this delegates to a [`CpalDriver`] configured with the WASAPI
/// host. On other platforms it returns [`DriverError::NotAvailable`].
pub struct WasapiDriver {
    sample_rate: u32,
    buffer_size: u32,
    #[cfg(target_os = "windows")]
    inner: crate::driver::CpalDriver,
}

impl WasapiDriver {
    /// Create a WASAPI driver instance.
    pub fn new(sample_rate: u32, buffer_size: u32) -> Self {
        #[cfg(target_os = "windows")]
        {
            Self {
                sample_rate,
                buffer_size,
                inner: crate::driver::CpalDriver::new_with_host_name(
                    "wasapi",
                    sample_rate,
                    buffer_size,
                ),
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            Self { sample_rate, buffer_size }
        }
    }
}

impl AudioDriver for WasapiDriver {
    fn name(&self) -> &str {
        "wasapi"
    }

    fn start(&mut self, callback: Box<dyn AudioCallback>) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            self.inner.start(callback)
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = callback;
            Err(DriverError::NotAvailable(
                "WASAPI is only available on Windows".to_string(),
            ))
        }
    }

    fn stop(&mut self) {
        #[cfg(target_os = "windows")]
        self.inner.stop();
    }

    fn list_devices(&self) -> (Vec<DeviceInfo>, Vec<DeviceInfo>) {
        #[cfg(target_os = "windows")]
        return self.inner.list_devices();
        #[cfg(not(target_os = "windows"))]
        (Vec::new(), Vec::new())
    }

    fn latency_frames(&self) -> u32 {
        #[cfg(target_os = "windows")]
        return self.inner.latency_frames();
        #[cfg(not(target_os = "windows"))]
        0
    }

    fn sample_rate(&self) -> u32 {
        #[cfg(target_os = "windows")]
        return self.inner.sample_rate();
        #[cfg(not(target_os = "windows"))]
        0
    }

    fn buffer_size(&self) -> u32 {
        #[cfg(target_os = "windows")]
        return self.inner.buffer_size();
        #[cfg(not(target_os = "windows"))]
        0
    }
}
