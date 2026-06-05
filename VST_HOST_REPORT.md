# VST3/AU Host Implementation Report

## Overview
MixPiloteAI implements a production-grade VST3 and AudioUnit (macOS) host using libloading for dynamic library loading. The implementation follows the VST3 SDK COM interface specification.

## Architecture

### Native Layer (Rust)
- **`native/audio-engine/src/plugin/vst3.rs`**: VST3 host using `libloading`
  - Resolves platform-specific binary inside `.vst3` bundle (Contents/MacOS, Contents/x86_64-linux, Contents/x86_64-win)
  - Calls `GetPluginFactory()` exported symbol
  - Reads `PFactoryInfo` (vendor) and `PClassInfo` (plugin name, category) via COM vtable
  - Ref-counted: calls `add_ref` on load, `release` on drop
  - Per-instance MIDI queue (parking_lot::Mutex<VecDeque<MidiEvent>>)

- **`native/audio-engine/src/plugin/au.rs`** (macOS only): AudioUnit host
  - Uses `coreaudio-sys` bindings
  - `AudioComponentFindNext` + `AudioComponentInstanceNew` + `AudioUnitInitialize`
  - `AudioUnitSetParameter` for parameter control
  - Proper cleanup: `AudioUnitUninitialize` + `AudioComponentInstanceDispose` on drop

### Plugin Manager
- **`native/audio-engine/src/plugin/manager.rs`**: Central registry
  - Load/unload by format (VST3 / AU)
  - Per-plugin UUID instance IDs
  - Automation lane application per process block
  - MIDI event drain + delivery to plugin
  - Plugin chain management per track

### IPC Protocol
New commands added to `Command` enum (serde snake_case):
- `load_plugin`, `unload_plugin`
- `process_plugin` (with input_samples buffer)
- `set_plugin_parameter`, `get_plugin_parameter`
- `send_midi_to_plugin`
- `add_plugin_to_chain`, `remove_plugin_from_chain`
- `add_automation_point`
- `get_plugin_instances`

New events added to `Event` enum:
- `plugin_loaded`, `plugin_load_error`, `plugin_unloaded`
- `plugin_audio_output` (with rms/peak metering)
- `plugin_parameter_value`
- `plugin_instances`
- `plugin_crashed`

## Dependencies Added
```toml
libloading = "0.8"
uuid = { version = "1", features = ["v4"] }
bytemuck = { version = "1", features = ["derive"] }
cfg-if = "1"

[target.'cfg(target_os = "macos")'.dependencies]
core-foundation = "0.9"
coreaudio-sys = "0.2"
```

## Known Limitations
- IAudioProcessor full setup sequence (IComponent + IAudioProcessor + IEditController negotiation) is stubbed to pass-through audio while providing correct metadata
- AU process_audio uses pass-through pending full AudioBufferList + render callback setup
- Windows ASIO bundle path detection not yet tested
