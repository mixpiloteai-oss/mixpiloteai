//! MIDI event types and per-plugin routing queues.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use parking_lot::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MidiEventType {
    NoteOn,
    NoteOff,
    ControlChange,
    ProgramChange,
    PitchBend,
    Aftertouch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MidiEvent {
    pub event_type: MidiEventType,
    pub channel: u8,
    pub note: u8,
    pub velocity: u8,
    pub control: u8,
    pub value: u8,
    pub pitch_bend: i16,
    /// Sample-accurate timing offset within the current buffer.
    pub sample_offset: u32,
}

/// Routes MIDI events to per-plugin queues.
pub struct MidiRouter {
    queues: std::collections::HashMap<String, Mutex<VecDeque<MidiEvent>>>,
}

impl MidiRouter {
    pub fn new() -> Self {
        MidiRouter {
            queues: std::collections::HashMap::new(),
        }
    }

    pub fn register_plugin(&mut self, instance_id: &str) {
        self.queues
            .insert(instance_id.to_string(), Mutex::new(VecDeque::new()));
    }

    pub fn unregister_plugin(&mut self, instance_id: &str) {
        self.queues.remove(instance_id);
    }

    pub fn send_midi(&self, instance_id: &str, event: MidiEvent) {
        if let Some(q) = self.queues.get(instance_id) {
            q.lock().push_back(event);
        }
    }

    pub fn drain_midi(&self, instance_id: &str) -> Vec<MidiEvent> {
        self.queues
            .get(instance_id)
            .map(|q| q.lock().drain(..).collect())
            .unwrap_or_default()
    }
}

impl Default for MidiRouter {
    fn default() -> Self {
        Self::new()
    }
}
