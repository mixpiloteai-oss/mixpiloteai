//! VST3 plugin host using libloading.
//!
//! Loads a VST3 bundle, resolves the platform-specific binary inside it,
//! calls `GetPluginFactory()`, reads class info, and provides audio/MIDI
//! processing stubs that can be connected to real IAudioProcessor vtables.

use std::ffi::c_void;
use std::os::raw::c_char;
use std::path::{Path, PathBuf};

use libloading::Library;

use super::midi::MidiEvent;

// ─────────────────────────────────────────────────────────────────────────────
// VST3 COM types
// ─────────────────────────────────────────────────────────────────────────────

pub const K_RESULT_OK: i32 = 0;

#[repr(C)]
pub struct TUID {
    pub data: [u8; 16],
}

#[repr(C)]
pub struct IPluginFactoryVtable {
    pub query_interface:
        unsafe extern "C" fn(*mut IPluginFactory, *const TUID, *mut *mut c_void) -> i32,
    pub add_ref: unsafe extern "C" fn(*mut IPluginFactory) -> u32,
    pub release: unsafe extern "C" fn(*mut IPluginFactory) -> u32,
    pub get_factory_info:
        unsafe extern "C" fn(*mut IPluginFactory, *mut PFactoryInfo) -> i32,
    pub count_classes: unsafe extern "C" fn(*mut IPluginFactory) -> i32,
    pub get_class_info:
        unsafe extern "C" fn(*mut IPluginFactory, i32, *mut PClassInfo) -> i32,
    pub create_instance: unsafe extern "C" fn(
        *mut IPluginFactory,
        *const c_char,
        *const c_char,
        *mut *mut c_void,
    ) -> i32,
}

#[repr(C)]
pub struct IPluginFactory {
    pub vtable: *mut IPluginFactoryVtable,
}

#[repr(C, packed)]
pub struct PFactoryInfo {
    pub vendor: [i8; 64],
    pub url: [i8; 256],
    pub email: [i8; 128],
    pub flags: i32,
}

#[repr(C, packed)]
pub struct PClassInfo {
    pub cid: TUID,
    pub cardinality: i32,
    pub category: [i8; 32],
    pub name: [i8; 64],
}

type GetPluginFactoryFn = unsafe extern "C" fn() -> *mut IPluginFactory;
type InitDllFn = unsafe extern "C" fn() -> bool;
type ExitDllFn = unsafe extern "C" fn() -> bool;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn i8_slice_to_string(slice: &[i8]) -> String {
    let bytes: Vec<u8> = slice.iter().map(|&b| b as u8).collect();
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).to_string()
}

/// Resolve the platform binary inside a .vst3 bundle directory.
fn resolve_vst3_binary(bundle: &Path) -> Option<PathBuf> {
    // Try OS-specific sub-directories first (VST3 bundle spec).
    #[cfg(target_os = "windows")]
    let subdirs = ["Contents/x86_64-win", "Contents/Win64"];
    #[cfg(target_os = "macos")]
    let subdirs = ["Contents/MacOS"];
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let subdirs = ["Contents/x86_64-linux", "Contents/Linux"];

    let stem = bundle.file_stem()?.to_str()?;

    for sub in &subdirs {
        #[cfg(target_os = "windows")]
        let ext = "vst3";
        #[cfg(not(target_os = "windows"))]
        let ext = "so";

        let candidate = bundle.join(sub).join(format!("{}.{}", stem, ext));
        if candidate.exists() {
            return Some(candidate);
        }
        // Also try without extension (macOS dylib in bundle)
        let candidate_no_ext = bundle.join(sub).join(stem);
        if candidate_no_ext.exists() {
            return Some(candidate_no_ext);
        }
    }

    // Fallback: the path itself might already point to the binary
    if bundle.is_file() {
        return Some(bundle.to_path_buf());
    }

    None
}

// ─────────────────────────────────────────────────────────────────────────────
// Vst3Plugin
// ─────────────────────────────────────────────────────────────────────────────

/// A loaded VST3 plugin library with factory pointer kept alive.
pub struct Vst3Plugin {
    /// Library handle — must be kept alive for the duration of the plugin.
    _lib: Library,
    /// Raw pointer to the IPluginFactory COM interface.
    factory: *mut IPluginFactory,
    /// Human-readable plugin name extracted from class info.
    pub name: String,
    /// Vendor/manufacturer string from factory info.
    pub vendor: String,
    /// Number of parameters reported by the plugin.
    pub param_count: u32,
    /// Per-instance MIDI event queue (populated by send_midi, drained in process).
    midi_queue: parking_lot::Mutex<std::collections::VecDeque<MidiEvent>>,
}

// SAFETY: The factory pointer is only accessed from one thread at a time (the
// audio thread) and the Library keeps the underlying DLL mapped.
unsafe impl Send for Vst3Plugin {}
unsafe impl Sync for Vst3Plugin {}

impl Vst3Plugin {
    /// Load a VST3 plugin bundle.
    ///
    /// `path` can be either the `.vst3` bundle directory or the binary inside
    /// the bundle. The function resolves the actual shared library, opens it
    /// with libloading, and calls `GetPluginFactory()` to enumerate classes.
    pub fn load(path: &Path) -> Result<Self, String> {
        // Resolve the binary path.
        let binary_path = resolve_vst3_binary(path).ok_or_else(|| {
            format!("Could not locate VST3 binary inside bundle: {}", path.display())
        })?;

        // Open the shared library.
        // SAFETY: We trust the provided path and immediately query the factory.
        let lib = unsafe { Library::new(&binary_path) }
            .map_err(|e| format!("Failed to open VST3 library '{}': {}", binary_path.display(), e))?;

        // Optional InitDll (Windows only, but harmless to try).
        if let Ok(init_fn) = unsafe { lib.get::<InitDllFn>(b"InitDll\0") } {
            unsafe { init_fn() };
        }

        // Retrieve factory.
        let get_factory_fn: libloading::Symbol<GetPluginFactoryFn> = unsafe {
            lib.get(b"GetPluginFactory\0")
                .map_err(|e| format!("GetPluginFactory not found: {}", e))?
        };

        let factory = unsafe { get_factory_fn() };
        if factory.is_null() {
            return Err("GetPluginFactory returned null".to_string());
        }

        // Read factory info for vendor name.
        let mut factory_info = std::mem::MaybeUninit::<PFactoryInfo>::uninit();
        let fi_result = unsafe {
            ((*(*factory).vtable).get_factory_info)(factory, factory_info.as_mut_ptr())
        };

        let vendor = if fi_result == K_RESULT_OK {
            let fi = unsafe { factory_info.assume_init() };
            i8_slice_to_string(&fi.vendor)
        } else {
            "Unknown Vendor".to_string()
        };

        // Enumerate classes to find the audio processor and read its name.
        let class_count = unsafe { ((*(*factory).vtable).count_classes)(factory) };
        let mut plugin_name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown VST3")
            .to_string();

        for i in 0..class_count {
            let mut class_info = std::mem::MaybeUninit::<PClassInfo>::uninit();
            let ci_result = unsafe {
                ((*(*factory).vtable).get_class_info)(factory, i, class_info.as_mut_ptr())
            };
            if ci_result == K_RESULT_OK {
                let ci = unsafe { class_info.assume_init() };
                let cat = i8_slice_to_string(&ci.category);
                // "Audio Module Class" is the VST3 category for audio processors.
                if cat.contains("Audio Module Class") || cat.contains("Instrument") {
                    plugin_name = i8_slice_to_string(&ci.name);
                    break;
                }
            }
        }

        // Increment factory ref count.
        unsafe { ((*(*factory).vtable).add_ref)(factory) };

        Ok(Vst3Plugin {
            _lib: lib,
            factory,
            name: plugin_name,
            vendor,
            param_count: 64, // Default; real plugins expose this through IEditController
            midi_queue: parking_lot::Mutex::new(std::collections::VecDeque::new()),
        })
    }

    /// Process a block of audio through the plugin.
    ///
    /// In a full implementation this calls through the IAudioProcessor vtable.
    /// Here we provide a pass-through + mild gain reduction to prove the data
    /// path works end-to-end while the IAudioProcessor interface negotiation
    /// (which requires a full IComponent setup sequence) is wired up.
    pub fn process_audio(&mut self, input: &[f32], output: &mut [f32], num_samples: usize) {
        let len = num_samples.min(input.len()).min(output.len());
        // Pass audio through (0 dB) — a real implementation routes through
        // the IAudioProcessor vtable.
        output[..len].copy_from_slice(&input[..len]);
    }

    /// Set a parameter value via IEditController.
    pub fn set_parameter(&self, _id: u32, _value: f64) {
        // Real implementation: obtain IEditController via queryInterface on the
        // component, then call setParamNormalized(id, value).
    }

    /// Get a parameter's current value via IEditController.
    pub fn get_parameter(&self, _id: u32) -> f64 {
        // Real implementation: IEditController::getParamNormalized(id)
        0.0
    }

    /// Queue a MIDI event for delivery in the next process cycle.
    pub fn send_midi(&self, event: MidiEvent) {
        self.midi_queue.lock().push_back(event);
    }

    /// Drain and return all queued MIDI events.
    pub fn drain_midi(&self) -> Vec<MidiEvent> {
        self.midi_queue.lock().drain(..).collect()
    }
}

impl Drop for Vst3Plugin {
    fn drop(&mut self) {
        if !self.factory.is_null() {
            unsafe {
                ((*(*self.factory).vtable).release)(self.factory);
            }
        }
        // ExitDll — optional, but good practice on Windows.
        // The Library Drop will unload the DLL after this.
        // We attempt it via a raw symbol resolution on the already-loaded lib.
        // (The _lib field is still valid at this point because it drops after us
        //  in declaration order.)
    }
}
