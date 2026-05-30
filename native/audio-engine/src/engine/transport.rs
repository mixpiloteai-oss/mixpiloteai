//! Transport module — manages playback position, tempo, and loop state.
//!
//! All position arithmetic is done in 64-bit sample counts to avoid
//! floating-point drift over long sessions.

/// Ticks per beat (PPQN — Pulses Per Quarter Note).
pub const TICKS_PER_BEAT: u64 = 480;

/// Compact bar/beat/tick position.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransportPosition {
    pub bar: u32,
    pub beat: u32,
    pub tick: u32,
}

/// Time signature.
#[derive(Debug, Clone, Copy)]
pub struct TimeSig {
    pub numerator: u32,
    pub denominator: u32,
}

impl Default for TimeSig {
    fn default() -> Self {
        Self { numerator: 4, denominator: 4 }
    }
}

/// Central transport state.
///
/// Tracks playback position in samples and derives musical position
/// (bar/beat/tick) on demand. All mutation happens on the audio thread;
/// the [`SharedState`] atomics mirror the values for UI reads.
#[derive(Debug)]
pub struct Transport {
    /// Whether playback is currently running.
    pub playing: bool,
    /// Whether recording is active.
    pub recording: bool,
    /// Whether loop playback is engaged.
    pub looping: bool,

    /// Tempo in beats per minute.
    pub bpm: f64,
    /// Current time signature.
    pub time_sig: TimeSig,

    /// Loop start in bars (1-based).
    pub loop_start_bar: u32,
    /// Loop end in bars (1-based, exclusive).
    pub loop_end_bar: u32,

    /// Current playback position in samples (from the start of the session).
    pub sample_position: u64,
    /// Audio sample rate in Hz.
    pub sample_rate: u32,
}

impl Transport {
    /// Create a new transport at default state (stopped, 120 BPM, 4/4).
    pub fn new(sample_rate: u32) -> Self {
        Self {
            playing: false,
            recording: false,
            looping: false,
            bpm: 120.0,
            time_sig: TimeSig::default(),
            loop_start_bar: 1,
            loop_end_bar: 9,
            sample_position: 0,
            sample_rate,
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tempo helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// Seconds per beat at the current BPM.
    #[inline]
    pub fn seconds_per_beat(&self) -> f64 {
        60.0 / self.bpm
    }

    /// Samples per beat at the current BPM and sample rate.
    #[inline]
    pub fn samples_per_beat(&self) -> f64 {
        self.seconds_per_beat() * self.sample_rate as f64
    }

    /// Samples per tick.
    #[allow(dead_code)]
    #[inline]
    pub fn samples_per_tick(&self) -> f64 {
        self.samples_per_beat() / TICKS_PER_BEAT as f64
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Position
    // ─────────────────────────────────────────────────────────────────────────

    /// Derive the current musical position from `sample_position`.
    pub fn position(&self) -> TransportPosition {
        let spb = self.samples_per_beat();
        if spb <= 0.0 {
            return TransportPosition { bar: 1, beat: 1, tick: 0 };
        }

        let total_beats = self.sample_position as f64 / spb;
        let beats_int = total_beats as u64;
        let beats_per_bar = self.time_sig.numerator as u64;

        let bar = (beats_int / beats_per_bar) as u32 + 1; // 1-based
        let beat = (beats_int % beats_per_bar) as u32 + 1; // 1-based

        let fractional_beat = total_beats - beats_int as f64;
        let tick = (fractional_beat * TICKS_PER_BEAT as f64) as u32;

        TransportPosition { bar, beat, tick }
    }

    /// Seek to a bar/beat position (1-based).
    pub fn seek_to(&mut self, bar: u32, beat: u32) {
        let bar = bar.max(1);
        let beat = beat.max(1);
        let spb = self.samples_per_beat();
        let beats_per_bar = self.time_sig.numerator as u64;
        let total_beats =
            (bar as u64 - 1) * beats_per_bar + (beat as u64 - 1).min(beats_per_bar - 1);
        self.sample_position = (total_beats as f64 * spb) as u64;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Advance
    // ─────────────────────────────────────────────────────────────────────────

    /// Advance the transport by `frames` samples.
    ///
    /// If looping is enabled and the position crosses the loop end, wraps back
    /// to the loop start.
    ///
    /// Returns `true` if a loop wrap occurred.
    pub fn advance(&mut self, frames: usize) -> bool {
        if !self.playing {
            return false;
        }

        self.sample_position += frames as u64;

        if self.looping {
            let loop_end = self.bar_to_samples(self.loop_end_bar);
            if self.sample_position >= loop_end {
                let loop_start = self.bar_to_samples(self.loop_start_bar);
                // Preserve any overshoot to keep timing tight.
                let overshoot = self.sample_position - loop_end;
                self.sample_position = loop_start + overshoot;
                return true;
            }
        }

        false
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// Convert a 1-based bar number to a sample offset.
    fn bar_to_samples(&self, bar: u32) -> u64 {
        let bar = bar.max(1) as u64;
        let beats_per_bar = self.time_sig.numerator as u64;
        let spb = self.samples_per_beat();
        ((bar - 1) * beats_per_bar) as u64 * spb as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_position_at_start() {
        let t = Transport::new(44100);
        let p = t.position();
        assert_eq!(p.bar, 1);
        assert_eq!(p.beat, 1);
        assert_eq!(p.tick, 0);
    }

    #[test]
    fn test_advance_one_beat() {
        let mut t = Transport::new(44100);
        t.playing = true;
        let spb = t.samples_per_beat() as usize;
        t.advance(spb);
        let p = t.position();
        assert_eq!(p.bar, 1);
        assert_eq!(p.beat, 2);
    }

    #[test]
    fn test_loop_wrap() {
        let mut t = Transport::new(44100);
        t.playing = true;
        t.looping = true;
        t.loop_start_bar = 1;
        t.loop_end_bar = 2;
        // Advance past the end of bar 1 (4 beats * spb).
        let spb = t.samples_per_beat() as usize;
        let wrapped = t.advance(spb * 4 + 1);
        assert!(wrapped);
        let p = t.position();
        assert_eq!(p.bar, 1);
    }
}
