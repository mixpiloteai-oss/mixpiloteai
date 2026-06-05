//! Plugin instance manager: load/unload, process audio, MIDI, automation, chains.

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::automation::AutomationLane;
use super::midi::{MidiEvent, MidiRouter};
use super::processor::{AudioBuffer, PluginChain, ProcessContext};
use super::vst3::Vst3Plugin;

#[cfg(target_os = "macos")]
use super::au::AuPlugin;

// ─────────────────────────────────────────────────────────────────────────────
// Public info type (serializable for IPC)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInstanceInfo {
    pub instance_id: String,
    pub plugin_path: String,
    pub format: String,
    pub name: String,
    pub vendor: String,
    pub param_count: u32,
    pub version: String,
    pub latency_samples: u32,
    pub is_active: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal plugin handle enum
// ─────────────────────────────────────────────────────────────────────────────

enum PluginHandle {
    Vst3(Vst3Plugin),
    #[cfg(target_os = "macos")]
    Au(AuPlugin),
}

impl PluginHandle {
    fn name(&self) -> &str {
        match self {
            PluginHandle::Vst3(p) => &p.name,
            #[cfg(target_os = "macos")]
            PluginHandle::Au(p) => &p.name,
        }
    }

    fn vendor(&self) -> &str {
        match self {
            PluginHandle::Vst3(p) => &p.vendor,
            #[cfg(target_os = "macos")]
            PluginHandle::Au(p) => &p.vendor,
        }
    }

    fn param_count(&self) -> u32 {
        match self {
            PluginHandle::Vst3(p) => p.param_count,
            #[cfg(target_os = "macos")]
            PluginHandle::Au(p) => p.param_count,
        }
    }

    fn process_audio(&mut self, input: &[f32], output: &mut [f32], n: usize) {
        match self {
            PluginHandle::Vst3(p) => p.process_audio(input, output, n),
            #[cfg(target_os = "macos")]
            PluginHandle::Au(p) => p.process_audio(input, output, n),
        }
    }

    fn set_parameter(&self, id: u32, value: f64) {
        match self {
            PluginHandle::Vst3(p) => p.set_parameter(id, value),
            #[cfg(target_os = "macos")]
            PluginHandle::Au(p) => p.set_parameter(id, value as f32),
        }
    }

    fn get_parameter(&self, id: u32) -> f64 {
        match self {
            PluginHandle::Vst3(p) => p.get_parameter(id),
            #[cfg(target_os = "macos")]
            PluginHandle::Au(_) => 0.0,
        }
    }

    fn send_midi(&self, event: MidiEvent) {
        match self {
            PluginHandle::Vst3(p) => p.send_midi(event),
            #[cfg(target_os = "macos")]
            PluginHandle::Au(_) => { /* AU MIDI not implemented */ }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PluginManager
// ─────────────────────────────────────────────────────────────────────────────

pub struct PluginManager {
    instances: HashMap<String, PluginHandle>,
    pub midi_router: MidiRouter,
    pub chains: HashMap<String, PluginChain>,
    /// Per-instance automation lanes.
    pub automation: HashMap<String, Vec<AutomationLane>>,
}

impl PluginManager {
    pub fn new() -> Self {
        PluginManager {
            instances: HashMap::new(),
            midi_router: MidiRouter::new(),
            chains: HashMap::new(),
            automation: HashMap::new(),
        }
    }

    // ── Load / unload ────────────────────────────────────────────────────────

    /// Load a plugin and register it under `instance_id`.
    ///
    /// `instance_id` is supplied by the UI so both sides share the same key.
    /// Pass an empty string to have the engine generate one automatically.
    pub fn load_plugin(
        &mut self,
        instance_id: &str,
        path: &str,
        format: &str,
    ) -> Result<PluginInstanceInfo, String> {
        let p = Path::new(path);
        let instance_id = if instance_id.is_empty() {
            Uuid::new_v4().to_string()
        } else {
            instance_id.to_string()
        };

        let handle = match format.to_uppercase().as_str() {
            "VST3" => {
                let plugin = Vst3Plugin::load(p)?;
                PluginHandle::Vst3(plugin)
            }
            "AU" => {
                #[cfg(target_os = "macos")]
                {
                    let plugin = AuPlugin::load(p)?;
                    PluginHandle::Au(plugin)
                }
                #[cfg(not(target_os = "macos"))]
                {
                    return Err("AudioUnit plugins are only supported on macOS".to_string());
                }
            }
            other => return Err(format!("Unsupported plugin format: {}", other)),
        };

        let info = PluginInstanceInfo {
            instance_id: instance_id.clone(),
            plugin_path: path.to_string(),
            format: format.to_string(),
            name: handle.name().to_string(),
            vendor: handle.vendor().to_string(),
            param_count: handle.param_count(),
            version: "1.0.0".to_string(),
            latency_samples: 0,
            is_active: true,
        };

        self.midi_router.register_plugin(&instance_id);
        self.automation.insert(instance_id.clone(), Vec::new());
        self.instances.insert(instance_id, handle);

        Ok(info)
    }

    pub fn unload_plugin(&mut self, instance_id: &str) -> Result<(), String> {
        self.instances
            .remove(instance_id)
            .ok_or_else(|| format!("Instance not found: {}", instance_id))?;
        self.midi_router.unregister_plugin(instance_id);
        self.automation.remove(instance_id);
        for chain in self.chains.values_mut() {
            chain.remove_slot(instance_id);
        }
        Ok(())
    }

    // ── Audio processing ─────────────────────────────────────────────────────

    pub fn process_plugin(
        &mut self,
        instance_id: &str,
        input: &AudioBuffer,
        output: &mut AudioBuffer,
        ctx: &ProcessContext,
    ) -> Result<(), String> {
        // Apply automation first (immutable borrow).
        if let Some(lanes) = self.automation.get(instance_id) {
            let values: Vec<(u32, f64)> = lanes
                .iter()
                .filter_map(|lane| {
                    lane.value_at(ctx.bar, ctx.beat, ctx.tick, ctx.ticks_per_beat)
                        .map(|v| (lane.param_id, v))
                })
                .collect();
            // Now apply with mutable borrow.
            if let Some(handle) = self.instances.get_mut(instance_id) {
                for (param_id, val) in values {
                    handle.set_parameter(param_id, val);
                }
            }
        }

        // Drain and deliver MIDI events.
        let midi_events = self.midi_router.drain_midi(instance_id);
        if let Some(handle) = self.instances.get_mut(instance_id) {
            for event in midi_events {
                handle.send_midi(event);
            }
        }

        // Process audio.
        let handle = self
            .instances
            .get_mut(instance_id)
            .ok_or_else(|| format!("Instance not found: {}", instance_id))?;

        let n = input.samples as usize;
        handle.process_audio(&input.data, &mut output.data, n);
        Ok(())
    }

    // ── Parameters ──────────────────────────────────────────────────────────

    pub fn set_parameter(
        &mut self,
        instance_id: &str,
        param_id: u32,
        value: f64,
    ) -> Result<(), String> {
        let handle = self
            .instances
            .get_mut(instance_id)
            .ok_or_else(|| format!("Instance not found: {}", instance_id))?;
        handle.set_parameter(param_id, value);
        Ok(())
    }

    pub fn get_parameter(&self, instance_id: &str, param_id: u32) -> Result<f64, String> {
        let handle = self
            .instances
            .get(instance_id)
            .ok_or_else(|| format!("Instance not found: {}", instance_id))?;
        Ok(handle.get_parameter(param_id))
    }

    // ── Accessors ────────────────────────────────────────────────────────────

    pub fn get_all_instances(&self) -> Vec<String> {
        self.instances.keys().cloned().collect()
    }

    // ── Automation ───────────────────────────────────────────────────────────

    pub fn add_automation_point(
        &mut self,
        instance_id: &str,
        param_id: u32,
        bar: u32,
        beat: u32,
        tick: u32,
        value: f64,
        curve: f32,
    ) -> Result<(), String> {
        let lanes = self
            .automation
            .entry(instance_id.to_string())
            .or_default();
        let point = super::automation::AutomationPoint {
            bar,
            beat,
            tick,
            value,
            curve,
        };
        if let Some(lane) = lanes.iter_mut().find(|l| l.param_id == param_id) {
            lane.add_point(point);
        } else {
            let mut lane = AutomationLane::new(param_id);
            lane.add_point(point);
            lanes.push(lane);
        }
        Ok(())
    }

    // ── MIDI ─────────────────────────────────────────────────────────────────

    pub fn send_midi_to_plugin(&self, instance_id: &str, event: MidiEvent) {
        self.midi_router.send_midi(instance_id, event);
    }

    // ── Plugin chains ────────────────────────────────────────────────────────

    pub fn add_to_chain(&mut self, track_id: &str, instance_id: &str) {
        let chain = self
            .chains
            .entry(track_id.to_string())
            .or_insert_with(|| PluginChain::new(track_id.to_string()));
        chain.add_slot(instance_id.to_string());
    }

    pub fn remove_from_chain(&mut self, track_id: &str, instance_id: &str) {
        if let Some(chain) = self.chains.get_mut(track_id) {
            chain.remove_slot(instance_id);
        }
    }
}

impl Default for PluginManager {
    fn default() -> Self {
        Self::new()
    }
}
