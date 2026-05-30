//! Automation system — stores and evaluates parameter envelopes.
#![allow(dead_code)]
//!
//! Each [`AutomationLane`] holds a sorted list of [`AutomationPoint`]s for a
//! single parameter. At render time, `evaluate(beat)` interpolates between the
//! surrounding points according to the point's [`CurveType`].

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/// The parameter being automated on a track.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutoParam {
    Gain,
    Pan,
    /// Send gain — identified by the destination bus ID.
    Send(String),
}

/// Interpolation curve applied between two automation points.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CurveType {
    /// Straight-line interpolation.
    Linear,
    /// Smoothstep (ease-in / ease-out) interpolation.
    Smooth,
    /// Jump to the next value at the next point (hold current until then).
    Step,
    /// Hold the previous value until this point, then jump.
    Hold,
}

/// A single automation point in a lane.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationPoint {
    /// Musical position in beats (fractional beats allowed).
    pub beat: f64,
    /// Normalised parameter value (interpretation depends on [`AutoParam`]).
    pub value: f64,
    /// How to interpolate *from* this point toward the next one.
    pub curve: CurveType,
}

/// A full automation lane for one parameter on one track.
#[derive(Debug, Clone)]
pub struct AutomationLane {
    /// The track this lane belongs to.
    pub track_id: String,
    /// Which parameter is automated.
    pub param: AutoParam,
    /// Points sorted ascending by `beat`. Maintain this invariant on insert.
    pub points: Vec<AutomationPoint>,
    /// Whether this lane is active (if false, `evaluate` returns `None`).
    pub enabled: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

impl AutomationLane {
    /// Create an empty, enabled lane.
    pub fn new(track_id: impl Into<String>, param: AutoParam) -> Self {
        Self {
            track_id: track_id.into(),
            param,
            points: Vec::new(),
            enabled: true,
        }
    }

    /// Insert a point and keep the lane sorted by beat.
    pub fn insert(&mut self, point: AutomationPoint) {
        let pos = self
            .points
            .partition_point(|p| p.beat < point.beat);
        self.points.insert(pos, point);
    }

    /// Evaluate the automated value at `beat`.
    ///
    /// Returns `None` if the lane is disabled or has no points.
    /// If `beat` is before the first point or after the last, the boundary
    /// value is returned (no extrapolation).
    pub fn evaluate(&self, beat: f64) -> Option<f64> {
        if !self.enabled || self.points.is_empty() {
            return None;
        }

        // Before the first point — clamp.
        if beat <= self.points[0].beat {
            return Some(self.points[0].value);
        }

        // After the last point — clamp.
        let last = self.points.last().unwrap();
        if beat >= last.beat {
            return Some(last.value);
        }

        // Find the surrounding segment.
        let right_idx = self.points.partition_point(|p| p.beat <= beat);
        let left_idx = right_idx - 1;

        let left = &self.points[left_idx];
        let right = &self.points[right_idx];

        let t = (beat - left.beat) / (right.beat - left.beat);

        let value = match left.curve {
            CurveType::Linear => lerp(left.value, right.value, t),
            CurveType::Smooth => {
                // Smoothstep: 3t² - 2t³
                let s = t * t * (3.0 - 2.0 * t);
                lerp(left.value, right.value, s)
            }
            CurveType::Step => {
                // Jump to right.value at t == 1.0, hold left.value otherwise.
                if t >= 1.0 { right.value } else { left.value }
            }
            CurveType::Hold => {
                // Hold left.value until the right point is reached.
                left.value
            }
        };

        Some(value)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

#[inline]
fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_lane() -> AutomationLane {
        let mut lane = AutomationLane::new("tk-1", AutoParam::Gain);
        lane.insert(AutomationPoint { beat: 0.0, value: 0.0, curve: CurveType::Linear });
        lane.insert(AutomationPoint { beat: 4.0, value: 1.0, curve: CurveType::Linear });
        lane
    }

    #[test]
    fn test_midpoint_linear() {
        let lane = make_lane();
        let v = lane.evaluate(2.0).unwrap();
        assert!((v - 0.5).abs() < 1e-9);
    }

    #[test]
    fn test_clamp_before() {
        let lane = make_lane();
        assert_eq!(lane.evaluate(-1.0).unwrap(), 0.0);
    }

    #[test]
    fn test_clamp_after() {
        let lane = make_lane();
        assert_eq!(lane.evaluate(10.0).unwrap(), 1.0);
    }

    #[test]
    fn test_disabled() {
        let mut lane = make_lane();
        lane.enabled = false;
        assert!(lane.evaluate(2.0).is_none());
    }

    #[test]
    fn test_smooth() {
        let mut lane = AutomationLane::new("tk-2", AutoParam::Pan);
        lane.insert(AutomationPoint { beat: 0.0, value: 0.0, curve: CurveType::Smooth });
        lane.insert(AutomationPoint { beat: 4.0, value: 1.0, curve: CurveType::Smooth });
        // At midpoint, smoothstep(0.5) = 0.5
        let v = lane.evaluate(2.0).unwrap();
        assert!((v - 0.5).abs() < 1e-9);
    }
}
