# Plugin Compatibility List

## Supported Formats
| Format | Status    | Platform         | Notes                                    |
|--------|-----------|------------------|------------------------------------------|
| VST3   | Supported | Win / macOS / Linux | Full factory enumeration via libloading |
| AU     | Supported | macOS only       | Via coreaudio-sys AudioComponent API     |
| VST2   | Planned   | Win / macOS / Linux | Requires legacy VST2 SDK                |
| CLAP   | Planned   | All platforms    | Open standard, high priority             |

## VST3 Bundle Resolution
| Platform | Sub-directory           | Extension |
|----------|-------------------------|-----------|
| Windows  | Contents/x86_64-win     | .vst3     |
| macOS    | Contents/MacOS          | (no ext)  |
| Linux    | Contents/x86_64-linux   | .so       |

## Audio Unit Types (macOS)
| AU Type                  | kAudioUnitType constant    |
|--------------------------|----------------------------|
| Effect/processor         | kAudioUnitType_Effect      |
| Virtual instrument       | kAudioUnitType_MusicDevice |
| MIDI processor           | kAudioUnitType_MIDIProcessor|

## Known Compatible Plugin Categories
- VST3 Audio Module Class (standard audio processors)
- VST3 Instrument class (MusicDevice / VSTi)
- AU kAudioUnitType_Effect (EQs, compressors, reverbs, etc.)
- AU kAudioUnitType_MusicDevice (software synthesizers)

## Tested Configurations
- Linux x86_64: VST3 pass-through loading (no real plugins available in CI)
- macOS: AU infrastructure via CoreAudio frameworks
- Windows: VST3 binary in Contents/x86_64-win

## Blacklisting
Plugins that crash 3+ times are auto-blacklisted. Use `pluginRemoveFromBlacklist(path)` to re-enable.
