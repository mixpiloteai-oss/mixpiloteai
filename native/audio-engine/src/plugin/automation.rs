//! Automation lanes and point interpolation.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationPoint {
    pub bar: u32,
    pub beat: u32,
    pub tick: u32,
    /// Normalized value 0.0–1.0.
    pub value: f64,
    /// Interpolation curve: -1 = exponential, 0 = linear, 1 = logarithmic.
    pub curve: f32,
}

#[derive(Debug, Clone)]
pub struct AutomationLane {
    pub param_id: u32,
    pub points: Vec<AutomationPoint>,
    pub enabled: bool,
}

impl AutomationLane {
    pub fn new(param_id: u32) -> Self {
        AutomationLane {
            param_id,
            points: Vec::new(),
            enabled: true,
        }
    }

    /// Get the interpolated value at the given musical position.
    pub fn value_at(
        &self,
        bar: u32,
        beat: u32,
        tick: u32,
        ticks_per_beat: u32,
    ) -> Option<f64> {
        if self.points.is_empty() || !self.enabled {
            return None;
        }
        let pos = (bar as u64 * 4 * ticks_per_beat as u64)
            + (beat as u64 * ticks_per_beat as u64)
            + tick as u64;

        let mut prev: Option<&AutomationPoint> = None;
        let mut next: Option<&AutomationPoint> = None;

        for pt in &self.points {
            let pt_pos = (pt.bar as u64 * 4 * ticks_per_beat as u64)
                + (pt.beat as u64 * ticks_per_beat as u64)
                + pt.tick as u64;
            if pt_pos <= pos {
                prev = Some(pt);
            } else if next.is_none() {
                next = Some(pt);
                break;
            }
        }

        match (prev, next) {
            (Some(p), Some(n)) => {
                let p_pos = (p.bar as u64 * 4 * ticks_per_beat as u64)
                    + (p.beat as u64 * ticks_per_beat as u64)
                    + p.tick as u64;
                let n_pos = (n.bar as u64 * 4 * ticks_per_beat as u64)
                    + (n.beat as u64 * ticks_per_beat as u64)
                    + n.tick as u64;
                if n_pos == p_pos {
                    return Some(p.value);
                }
                let t = (pos - p_pos) as f64 / (n_pos - p_pos) as f64;
                // Linear interpolation (curve param reserved for future use).
                Some(p.value + t * (n.value - p.value))
            }
            (Some(p), None) => Some(p.value),
            (None, Some(n)) => Some(n.value),
            (None, None) => None,
        }
    }

    pub fn add_point(&mut self, point: AutomationPoint) {
        self.points.push(point);
        self.points
            .sort_by_key(|p| (p.bar, p.beat, p.tick));
    }

    pub fn remove_points_at(&mut self, bar: u32, beat: u32, tick: u32) {
        self.points
            .retain(|p| !(p.bar == bar && p.beat == beat && p.tick == tick));
    }
}
