//! ASIO driver stub (Windows only).
//!
//! ASIO (Audio Stream Input/Output) is a low-latency audio protocol developed
//! by Steinberg. It requires a proprietary SDK and a vendor-specific driver
//! installed on the host machine.
//!
//! This module provides a stub that:
//! - Returns a descriptive error if invoked without the `asio` Cargo feature.
//! - Delegates to [`cpal`]'s ASIO host when the `asio` feature *is* enabled.
//!
//! Enable with: `cargo build --features asio` (Windows only, requires the
//! `CPAL_ASIO_DIR` environment variable to point to the ASIO SDK root).

#![allow(dead_code)]

use crate::{
    driver::{AudioCallback, AudioDriver, DriverError, Result},
    ipc::protocol::DeviceInfo,
};

// ─────────────────────────────────────────────────────────────────────────────
// AsioDriver
// ─────────────────────────────────────────────────────────────────────────────

/// ASIO audio driver (Windows, `asio` feature required).
pub struct AsioDriver {
    sample_rate: u32,
    buffer_size: u32,
    /// Inner cpal-based ASIO driver (only populated with the `asio` feature).
    #[cfg(feature = "asio")]
    inner: Option<crate::driver::CpalDriver>,
}

impl AsioDriver {
    /// Create an ASIO driver instance.
    ///
    /// Construction always succeeds; failure is deferred to [`start`].
    pub fn new(sample_rate: u32, buffer_size: u32) -> Self {
        #[cfg(feature = "asio")]
        {
            Self {
                sample_rate,
                buffer_size,
                inner: Some(crate::driver::CpalDriver::new_with_host_name(
                    "asio",
                    sample_rate,
                    buffer_size,
                )),
            }
        }
        #[cfg(not(feature = "asio"))]
        {
            Self { sample_rate, buffer_size }
        }
    }
}

impl AudioDriver for AsioDriver {
    fn name(&self) -> &str {
        "asio"
    }

    fn start(&mut self, callback: Box<dyn AudioCallback>) -> Result<()> {
        #[cfg(feature = "asio")]
        {
            if let Some(inner) = &mut self.inner {
                return inner.start(callback);
            }
            Err(DriverError::Internal("ASIO inner driver not initialised".to_string()))
        }
        #[cfg(not(feature = "asio"))]
        {
            let _ = callback;
            Err(DriverError::NotAvailable(
                "ASIO requires the `asio` Cargo feature and the ASIO SDK. \
                 Rebuild with `--features asio` and set CPAL_ASIO_DIR."
                    .to_string(),
            ))
        }
    }

    fn stop(&mut self) {
        #[cfg(feature = "asio")]
        if let Some(inner) = &mut self.inner {
            inner.stop();
        }
    }

    fn list_devices(&self) -> (Vec<DeviceInfo>, Vec<DeviceInfo>) {
        #[cfg(feature = "asio")]
        if let Some(inner) = &self.inner {
            return inner.list_devices();
        }
        (Vec::new(), Vec::new())
    }

    fn latency_frames(&self) -> u32 {
        #[cfg(feature = "asio")]
        if let Some(inner) = &self.inner {
            return inner.latency_frames();
        }
        0
    }

    fn sample_rate(&self) -> u32 {
        #[cfg(feature = "asio")]
        if let Some(inner) = &self.inner {
            return inner.sample_rate();
        }
        0
    }

    fn buffer_size(&self) -> u32 {
        #[cfg(feature = "asio")]
        if let Some(inner) = &self.inner {
            return inner.buffer_size();
        }
        0
    }
}
