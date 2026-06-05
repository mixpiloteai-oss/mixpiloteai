//! Build script for the Neurotek Studio audio engine.
//!
//! Handles platform-specific link flags and feature detection.
//! On Windows with the `asio` feature, links against the ASIO SDK.

fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    match target_os.as_str() {
        "windows" => {
            // Link against Windows audio libraries
            println!("cargo:rustc-link-lib=ole32");
            println!("cargo:rustc-link-lib=user32");
            println!("cargo:rustc-link-lib=winmm");

            // ASIO SDK path (if ASIO feature is enabled)
            #[cfg(feature = "asio")]
            {
                if let Ok(asio_sdk) = std::env::var("CPAL_ASIO_DIR") {
                    println!("cargo:rustc-link-search={}", asio_sdk);
                    println!("cargo:rerun-if-env-changed=CPAL_ASIO_DIR");
                }
            }
        }
        "macos" => {
            // Link against Core Audio frameworks
            println!("cargo:rustc-link-lib=framework=CoreAudio");
            println!("cargo:rustc-link-lib=framework=AudioToolbox");
            println!("cargo:rustc-link-lib=framework=AudioUnit");
        }
        "linux" => {
            // ALSA is handled by cpal's build script
        }
        _ => {}
    }

    // Rerun if build.rs changes
    println!("cargo:rerun-if-changed=build.rs");
}
