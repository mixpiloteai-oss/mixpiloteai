export const metadata = { title: 'Features — Neurotek AI' }

const features = [
  { category: 'DAW', items: [
    { icon: '♪', title: 'Piano Roll', desc: 'Full MIDI editor with velocity editing, quantize, zoom, multi-select, and chord detection.' },
    { icon: '≡', title: 'Arrangement Timeline', desc: 'Pattern-based sequencer with clip dragging, loop regions, and scene launching.' },
    { icon: '⊟', title: 'Mixer', desc: 'Per-track faders, mute/solo, send/return routing, master bus with metering.' },
    { icon: '◈', title: 'Sample Browser', desc: 'Local library browser with drag-to-track, waveform preview, and tagging.' },
    { icon: '⏱', title: 'Transport', desc: 'BPM, time signature, play/pause/stop, loop toggle, metronome.' },
  ]},
  { category: 'AI', items: [
    { icon: '✦', title: 'Text-to-Pattern', desc: 'Describe a groove in plain text — AI generates a MIDI pattern instantly.' },
    { icon: '🎵', title: 'Chord Suggestions', desc: 'One-click AI chord progressions tuned to genre and key.' },
    { icon: '🎛', title: 'Genre Presets', desc: 'Mentalcore, Hardtek, Tribe, Acidcore, Hard Techno, Tekno — AI optimized for each.' },
  ]},
  { category: 'Desktop', items: [
    { icon: '🪟', title: 'Native Windows App', desc: 'Electron-based installer and portable .exe with ASIO / WASAPI audio backend.' },
    { icon: '⊕', title: 'VST2 / VST3 Support', desc: 'Plugin scanner with automatic path detection and hosting.' },
    { icon: '↑', title: 'Auto-Update', desc: 'Silent background updates so you always have the latest features.' },
    { icon: '☁', title: 'Cloud Sync', desc: 'Sync projects across devices (Pro / Studio plans).' },
  ]},
]

export default function FeaturesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-24">
      <h1 className="text-4xl font-bold text-nt-text mb-4 text-center">Features</h1>
      <p className="text-nt-muted text-center mb-16">Everything a producer needs, powered by AI.</p>
      {features.map(section => (
        <div key={section.category} className="mb-16">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-nt-cyan mb-6">{section.category}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {section.items.map(f => (
              <div key={f.title} className="p-6 rounded-2xl bg-nt-card border border-nt-border flex gap-4">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <h3 className="font-semibold text-nt-text mb-1">{f.title}</h3>
                  <p className="text-nt-muted text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
