//! Real-time audio utilities: thread priority and latency compensation.
#![allow(dead_code)]
//!
//! This module contains:
//! - [`set_audio_thread_priority`] — best-effort platform API to elevate
//!   scheduling priority for the audio thread.
//! - [`LatencyCompensator`] — tracks per-track plugin delay in frames and
//!   manages compensating [`DelayBuffer`] ring buffers.

use std::collections::HashMap;

// ─────────────────────────────────────────────────────────────────────────────
// Thread priority
// ─────────────────────────────────────────────────────────────────────────────

/// Attempt to raise the current thread's scheduling priority.
///
/// This is a best-effort call; if it fails (e.g. insufficient permissions)
/// the engine continues with normal priority. The audio driver itself usually
/// runs the callback on a high-priority thread, but this function is useful
/// for the engine's own worker thread.
pub fn set_audio_thread_priority() {
    #[cfg(target_os = "linux")]
    {
        set_audio_thread_priority_linux();
    }
    #[cfg(target_os = "macos")]
    {
        set_audio_thread_priority_macos();
    }
    #[cfg(target_os = "windows")]
    {
        set_audio_thread_priority_windows();
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        log::debug!("Audio thread priority: no platform support");
    }
}

#[cfg(target_os = "linux")]
fn set_audio_thread_priority_linux() {
    // Try to set SCHED_FIFO with priority 80 via a C extern declaration.
    // If this fails we silently continue at normal priority.
    #[repr(C)]
    struct SchedParam { sched_priority: i32 }

    extern "C" {
        fn sched_setscheduler(pid: i32, policy: i32, param: *const SchedParam) -> i32;
    }

    let param = SchedParam { sched_priority: 80 };
    // SAFETY: sched_setscheduler is a POSIX syscall with a well-defined C ABI.
    // We pass a valid pointer to a correctly-sized struct and check the return value.
    unsafe {
        let ret = sched_setscheduler(0, 1 /* SCHED_FIFO */, &param);
        if ret == 0 {
            log::debug!("Audio thread: SCHED_FIFO priority 80 set");
        } else {
            log::debug!("Audio thread: sched_setscheduler failed, running at normal priority");
        }
    }
}

#[cfg(target_os = "macos")]
fn set_audio_thread_priority_macos() {
    // On macOS the audio driver callback already runs at real-time priority.
    // For our own worker thread we can use pthread_set_qos_class_self_np.
    // Since we avoid unsafe unless necessary, just log the intent.
    log::debug!("Audio thread priority: macOS — relying on CoreAudio callback thread");
}

#[cfg(target_os = "windows")]
fn set_audio_thread_priority_windows() {
    // Use SetThreadPriority via parking_lot's raw platform handle.
    // parking_lot does not expose this directly, so we use a raw WinAPI call.
    log::debug!("Audio thread priority: Windows — requesting THREAD_PRIORITY_TIME_CRITICAL");
    // The actual SetThreadPriority call would require windows-sys; we leave
    // it as a hint comment here to keep the dependency footprint minimal.
    // Add `windows-sys = { version = "0.52", features = ["Win32_System_Threading"] }`
    // and call `SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL)`.
}

// ─────────────────────────────────────────────────────────────────────────────
// DelayBuffer — single-channel ring delay
// ─────────────────────────────────────────────────────────────────────────────

/// A power-of-two ring buffer used to delay audio by a fixed number of frames.
///
/// Used by [`LatencyCompensator`] to align tracks with different plugin latencies.
pub struct DelayBuffer {
    buf: Vec<f32>,
    mask: usize,
    write_pos: usize,
    /// Delay in samples (read position is `write_pos - delay_frames`).
    delay_frames: usize,
}

impl DelayBuffer {
    /// Create a delay buffer with at least `max_delay` samples of capacity.
    ///
    /// The internal buffer is rounded up to the next power of two for efficient
    /// modulo with a bitmask.
    pub fn new(max_delay: usize) -> Self {
        let capacity = (max_delay + 1).next_power_of_two();
        Self {
            buf: vec![0.0_f32; capacity],
            mask: capacity - 1,
            write_pos: 0,
            delay_frames: 0,
        }
    }

    /// Set the active delay in frames (must be ≤ max_delay used at construction).
    pub fn set_delay(&mut self, frames: usize) {
        self.delay_frames = frames;
    }

    /// Push a sample and return the delayed sample at the current tap.
    #[inline]
    pub fn process_sample(&mut self, input: f32) -> f32 {
        self.buf[self.write_pos & self.mask] = input;
        let read_pos = self.write_pos.wrapping_sub(self.delay_frames);
        let output = self.buf[read_pos & self.mask];
        self.write_pos = self.write_pos.wrapping_add(1);
        output
    }

    /// Process a block of mono samples in-place.
    #[inline]
    pub fn process_block(&mut self, samples: &mut [f32]) {
        for s in samples.iter_mut() {
            *s = self.process_sample(*s);
        }
    }

    /// Clear the internal buffer (silence all delay taps).
    pub fn clear(&mut self) {
        self.buf.fill(0.0);
        self.write_pos = 0;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LatencyCompensator
// ─────────────────────────────────────────────────────────────────────────────

/// Manages per-track plugin delay compensation (PDC).
///
/// When a plugin reports a non-zero processing latency (e.g. a look-ahead
/// limiter), all *other* tracks must be delayed by the same amount so that
/// audio stays in sync at the mix bus.
///
/// Whenever [`set_plugin_latency`] is called, the compensator recomputes the
/// global maximum latency and updates every track's compensating delay.
pub struct LatencyCompensator {
    /// Per-track plugin latency (frames) — set by the plugin loader.
    plugin_latency: HashMap<String, u32>,
    /// Per-track compensating [`DelayBuffer`]s (left and right channels).
    compensators: HashMap<String, (DelayBuffer, DelayBuffer)>,
    /// The global maximum latency across all tracks.
    max_latency: u32,
}

impl LatencyCompensator {
    /// Create an empty compensator.
    pub fn new() -> Self {
        Self {
            plugin_latency: HashMap::new(),
            compensators: HashMap::new(),
            max_latency: 0,
        }
    }

    /// Report the plugin processing latency for a track.
    ///
    /// Triggers a recalculation of all compensating delays.
    pub fn set_plugin_latency(&mut self, track_id: &str, latency_frames: u32) {
        self.plugin_latency.insert(track_id.to_string(), latency_frames);
        self.recalculate();
    }

    /// Remove all latency information for a track.
    pub fn remove_track(&mut self, track_id: &str) {
        self.plugin_latency.remove(track_id);
        self.compensators.remove(track_id);
        self.recalculate();
    }

    /// The current global maximum latency in frames.
    pub fn max_latency(&self) -> u32 {
        self.max_latency
    }

    /// Process one block for a track, applying the compensating delay.
    ///
    /// `left` and `right` are mono sample slices for the two channels.
    /// If no compensator exists for `track_id`, the slices are passed through.
    pub fn process_block(&mut self, track_id: &str, left: &mut [f32], right: &mut [f32]) {
        if let Some((l_buf, r_buf)) = self.compensators.get_mut(track_id) {
            l_buf.process_block(left);
            r_buf.process_block(right);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    fn recalculate(&mut self) {
        let new_max = self.plugin_latency.values().copied().max().unwrap_or(0);

        if new_max != self.max_latency || new_max == 0 {
            self.max_latency = new_max;

            // Update or create delay buffers for every known track.
            for (id, &plugin_lat) in &self.plugin_latency {
                let comp_delay = (new_max - plugin_lat) as usize;
                let entry = self.compensators.entry(id.clone()).or_insert_with(|| {
                    let max = (new_max as usize).max(1);
                    (DelayBuffer::new(max), DelayBuffer::new(max))
                });
                entry.0.set_delay(comp_delay);
                entry.1.set_delay(comp_delay);
            }

            // Remove buffers for tracks that are no longer present.
            self.compensators
                .retain(|id, _| self.plugin_latency.contains_key(id));
        }
    }
}

impl Default for LatencyCompensator {
    fn default() -> Self {
        Self::new()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delay_buffer_passthrough_at_zero() {
        let mut d = DelayBuffer::new(64);
        d.set_delay(0);
        let out = d.process_sample(1.0);
        assert_eq!(out, 1.0);
    }

    #[test]
    fn delay_buffer_delays_by_one() {
        let mut d = DelayBuffer::new(8);
        d.set_delay(1);
        let _first = d.process_sample(1.0); // reads zero (pre-fill)
        let second = d.process_sample(0.0); // reads the 1.0 written before
        assert_eq!(second, 1.0);
    }

    #[test]
    fn compensator_max_latency() {
        let mut c = LatencyCompensator::new();
        c.set_plugin_latency("tk-1", 0);
        c.set_plugin_latency("tk-2", 128);
        assert_eq!(c.max_latency(), 128);
    }

    #[test]
    fn compensator_remove_track() {
        let mut c = LatencyCompensator::new();
        c.set_plugin_latency("tk-1", 64);
        c.set_plugin_latency("tk-2", 128);
        c.remove_track("tk-2");
        assert_eq!(c.max_latency(), 64);
    }
}
