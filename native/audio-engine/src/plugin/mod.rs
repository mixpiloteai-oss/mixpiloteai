pub mod automation;
pub mod manager;
pub mod midi;
pub mod processor;
pub mod vst3;

#[cfg(target_os = "macos")]
pub mod au;

pub use automation::{AutomationLane, AutomationPoint};
pub use manager::{PluginInstanceInfo, PluginManager};
pub use midi::{MidiEvent, MidiEventType, MidiRouter};
pub use processor::{AudioBuffer, PluginProcessor, ProcessContext};
