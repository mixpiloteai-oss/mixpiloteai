import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-nt-purple/10 to-transparent pointer-events-none" />
        <span className="mb-4 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-nt-cyan border border-nt-cyan/30 rounded-full">
          Beta 1.0 — Free Download
        </span>
        <h1 className="text-5xl md:text-7xl font-extrabold text-nt-text leading-tight max-w-4xl">
          The AI-Powered<br />
          <span className="bg-gradient-to-r from-nt-purple to-nt-cyan bg-clip-text text-transparent">
            Music Production Studio
          </span>
        </h1>
        <p className="mt-6 text-lg text-nt-muted max-w-2xl">
          Generate beats, melodies, and full arrangements with one click.
          Professional-grade DAW. Fully offline. Built for the underground tekno scene.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/download"
            className="px-8 py-3 rounded-xl bg-nt-purple text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Download for Windows →
          </Link>
          <Link
            href="/pricing"
            className="px-8 py-3 rounded-xl border border-nt-border text-nt-text hover:border-nt-purple transition-colors"
          >
            View Pricing
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-4 py-20 w-full">
        <h2 className="text-3xl font-bold text-center text-nt-text mb-12">Everything you need to produce</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '♪', title: 'Piano Roll', desc: 'Full MIDI editor with velocity editing, quantize, zoom, multi-select.' },
            { icon: '≡', title: 'Arrangement', desc: 'Pattern-based sequencer with clip dragging and loop regions.' },
            { icon: '⊟', title: 'Mixer', desc: 'Per-track faders, mute/solo, send/return routing, master bus.' },
            { icon: '✦', title: 'AI Generation', desc: 'Text-to-pattern, chord suggestions, genre presets including Hardtek & Tekno.' },
            { icon: '⊕', title: 'VST Support', desc: 'VST2 / VST3 plugin scanner and hosting.' },
            { icon: '▶', title: 'Live Mode', desc: 'Clip launcher for live performance and improvisation.' },
          ].map(f => (
            <div key={f.title} className="p-6 rounded-2xl bg-nt-card border border-nt-border hover:border-nt-purple/50 transition-colors">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-nt-text mb-2">{f.title}</h3>
              <p className="text-nt-muted text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center bg-gradient-to-t from-nt-purple/10 to-transparent">
        <h2 className="text-3xl font-bold text-nt-text mb-4">Ready to produce?</h2>
        <p className="text-nt-muted mb-8">Free forever plan. No credit card required.</p>
        <Link href="/download" className="px-10 py-4 rounded-xl bg-gradient-to-r from-nt-purple to-nt-cyan text-white font-bold hover:opacity-90 transition-opacity">
          Download Free
        </Link>
      </section>
    </div>
  )
}
