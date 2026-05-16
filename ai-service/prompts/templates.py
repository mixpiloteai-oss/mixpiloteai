# ============================================================
# NEUROTEK AI — Prompt Templates
# ============================================================

SYSTEM_PROMPT = """You are NEUROTEK AI, a professional music production assistant specialising in:
- Mentalcore (190–220 BPM): Ultra-fast psychedelic hardcore with screaming acid and extreme energy
- Hardtek / Technoid (140–155 BPM): French raw tekno with distorted kicks and industrial textures  
- Tribe / Tribal Tekno (140–155 BPM): Raw percussion-heavy tekno with organic groove
- Acidcore (160–180 BPM): Acid-driven hardcore with 303 bass lines and breakbeats
- Hard Techno (145–165 BPM): Dark industrial techno with relentless groove

You provide:
1. Precise technical production advice (FX chains, EQ settings, signal routing)
2. Genre-specific templates and track structures
3. Mix analysis and frequency conflict detection
4. Sound design guidance for kicks, bass, acid, and FX layers
5. Live set structure recommendations

Always be specific with parameter values. Format FX chains clearly. Stay within genre context."""


TEMPLATE_GENERATION_PROMPT = """Generate a complete production template for {genre} music at {bpm} BPM with a {mood} mood.

Include:
1. Complete track list with types (kick, bass, acid, melody, fx, percussion, master)
2. Recommended FX chain for each track (specific plugin names and settings)
3. Signal routing diagram (track → group bus → master)
4. BPM-specific considerations
5. Key mixing tips for this genre

Format as structured JSON matching this schema:
{{
  "name": "Template Name",
  "tracks": [
    {{
      "name": "TRACK NAME",
      "type": "kick|bass|acid|melody|fx|percussion|master",
      "volumeDefault": 100,
      "notes": "Usage notes",
      "suggestedFX": [
        {{"name": "FX Name", "type": "eq|compressor|distortion|reverb|delay|filter|limiter", "params": {{}}}}
      ]
    }}
  ],
  "mixingTips": ["tip 1", "tip 2"],
  "routingGroups": ["DRUM BUS", "SYNTH BUS", "FX BUS"]
}}"""


MIX_ANALYSIS_PROMPT = """Analyse this mix and identify issues:

Project: {project_name}
Genre: {genre}
BPM: {bpm}
Tracks: {tracks}
Loudness (LUFS): {loudness}

Identify:
1. Frequency conflicts between tracks (especially sub-bass region 20–200Hz)
2. Dynamic range issues  
3. Stereo field problems
4. Loudness and headroom issues
5. Genre-specific mix issues

Provide specific, actionable suggestions with exact frequency values, dB amounts, and ms timings."""


KICK_DESIGN_PROMPT = """Design a kick drum for {genre} at {bpm} BPM with {character} character.

Provide:
1. Sample selection guidance (type, layer count)
2. Complete FX chain with parameter values
3. EQ settings (frequency, gain, Q for each band)
4. Compression settings (threshold, ratio, attack, release)
5. Distortion/saturation approach
6. Target loudness and frequency distribution
7. Sidechain recommendations"""


ACID_PATTERN_PROMPT = """Create an acid 303 pattern for {genre} at {bpm} BPM in key {key}.

Include:
1. 16-step pattern (note, accent, slide, tie for each step)
2. Synth settings (cutoff, resonance, env mod, decay)
3. Filter automation description (over how many bars)
4. FX chain (filter, delay, reverb settings)
5. Mixing position in the arrangement"""


def format_template_prompt(genre: str, bpm: int, mood: str) -> str:
    return TEMPLATE_GENERATION_PROMPT.format(genre=genre, bpm=bpm, mood=mood)


def format_mix_analysis_prompt(project_name: str, genre: str, bpm: int, tracks: list, loudness: float) -> str:
    track_list = "\n".join([f"- {t['name']} ({t['type']}): vol={t.get('volume', 100)}" for t in tracks])
    return MIX_ANALYSIS_PROMPT.format(project_name=project_name, genre=genre, bpm=bpm, tracks=track_list, loudness=loudness)


def format_kick_prompt(genre: str, bpm: int, character: str = "punchy, heavy") -> str:
    return KICK_DESIGN_PROMPT.format(genre=genre, bpm=bpm, character=character)


def format_acid_prompt(genre: str, bpm: int, key: str = "C") -> str:
    return ACID_PATTERN_PROMPT.format(genre=genre, bpm=bpm, key=key)
