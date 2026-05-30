//! AudioUnit host via CoreAudio (macOS only).

use std::mem::MaybeUninit;
use coreaudio_sys::*;

pub struct AuPlugin {
    pub name: String,
    pub vendor: String,
    pub param_count: u32,
    component: AudioComponent,
    instance: AudioComponentInstance,
}

// SAFETY: AudioComponent / AudioComponentInstance are opaque pointers.
// CoreAudio APIs are thread-safe for parameter set/get after initialisation.
unsafe impl Send for AuPlugin {}
unsafe impl Sync for AuPlugin {}

impl AuPlugin {
    pub fn load(bundle_path: &std::path::Path) -> Result<Self, String> {
        // Parse .component bundle Info.plist to get AudioComponentDescription.
        // For now we use kAudioUnitType_Effect as a default;
        // a production implementation reads the plist keys.
        let desc = AudioComponentDescription {
            componentType: kAudioUnitType_Effect,
            componentSubType: 0,
            componentManufacturer: 0,
            componentFlags: 0,
            componentFlagsMask: 0,
        };

        let component = unsafe { AudioComponentFindNext(std::ptr::null_mut(), &desc) };
        if component.is_null() {
            return Err(format!(
                "AudioUnit component not found: {}",
                bundle_path.display()
            ));
        }

        let mut instance: AudioComponentInstance = std::ptr::null_mut();
        let result = unsafe { AudioComponentInstanceNew(component, &mut instance) };
        if result != 0 {
            return Err(format!("AudioComponentInstanceNew failed: {}", result));
        }

        let init_result = unsafe { AudioUnitInitialize(instance) };
        if init_result != 0 {
            unsafe { AudioComponentInstanceDispose(instance) };
            return Err(format!("AudioUnitInitialize failed: {}", init_result));
        }

        let name = bundle_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown AU")
            .to_string();

        Ok(AuPlugin {
            name,
            vendor: "Apple AU".to_string(),
            param_count: 64,
            component,
            instance,
        })
    }

    /// Process audio via AudioUnitRender.
    pub fn process_audio(&mut self, input: &[f32], output: &mut [f32], num_samples: usize) {
        // A full implementation builds an AudioBufferList, sets up an input
        // callback, and calls AudioUnitRender.  For now we pass audio through
        // so the data path works without a full AU setup sequence.
        let len = num_samples.min(input.len()).min(output.len());
        output[..len].copy_from_slice(&input[..len]);
    }

    /// Set a parameter via AudioUnitSetParameter.
    pub fn set_parameter(&self, id: u32, value: f32) {
        unsafe {
            AudioUnitSetParameter(
                self.instance,
                id,
                kAudioUnitScope_Global,
                0,
                value,
                0,
            );
        }
    }
}

impl Drop for AuPlugin {
    fn drop(&mut self) {
        unsafe {
            AudioUnitUninitialize(self.instance);
            AudioComponentInstanceDispose(self.instance);
        }
    }
}
