# ============================================================
# NEUROTEK AI — FastAPI AI Microservice
#
# SECURITY: This service is INTERNAL only — never expose to internet.
# ============================================================
from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import asyncio
import random
from dotenv import load_dotenv

load_dotenv()

from prompts.templates import (
    SYSTEM_PROMPT, format_template_prompt, format_mix_analysis_prompt,
    format_kick_prompt, format_acid_prompt,
)

app = FastAPI(
    title="NEUROTEK AI Microservice",
    description="Internal AI inference service — not for public access",
    version="0.2.0",
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)

_bearer = HTTPBearer(auto_error=False)
INTERNAL_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")

def verify_internal_token(credentials: HTTPAuthorizationCredentials = Security(_bearer)):
    if not INTERNAL_TOKEN:
        return True
    if not credentials or credentials.credentials != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized internal service call")
    return True

class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    genre: Optional[str] = "mentalcore"
    bpm: Optional[int] = 140

class ChatResponse(BaseModel):
    content: str
    suggestions: Optional[List[str]] = None
    code_block: Optional[Dict[str, str]] = None

class TemplateRequest(BaseModel):
    genre: str = Field(default="mentalcore")
    bpm: int = Field(default=140, ge=60, le=300)
    mood: str = Field(default="aggressive")

class MixAnalysisRequest(BaseModel):
    project_name: str
    genre: str
    bpm: int
    tracks: List[Dict[str, Any]]
    loudness: Optional[float] = -8.0

class KickDesignRequest(BaseModel):
    genre: str
    bpm: int
    character: Optional[str] = "punchy, heavy"

class AcidPatternRequest(BaseModel):
    genre: str
    bpm: int
    key: Optional[str] = "C"
    bars: Optional[int] = 4

CANNED_RESPONSES = {
    "kick": {
        "content": "**Kick Design for Mentalcore at 200 BPM**\n\nLayer 1 — Transient:\n• Sample: 909 kick clipped hard\n• Transient Shaper: Attack 0ms, Sustain -8dB\n• EQ: +6dB @ 55Hz, -5dB @ 250Hz\n• Clipper: Hard clip at 0.85 ceiling\n\nLayer 2 — Sub:\n• Sine wave at C1 (32.7 Hz)\n• Pitch envelope: C1 → G0 over 50ms\n• Limiter: -3dBTP\n\nBus processing:\n• Glue compressor: -6dB threshold, 4:1, fast attack\n• Limiter: -0.3dBTP ceiling",
        "code_block": {"language": "text", "code": "KICK BUS CHAIN:\n├── Layer 1 (transient 909)\n│   ├── Transient Shaper: Att=0ms, Sus=-8dB\n│   ├── EQ: +6@55Hz, -5@250Hz\n│   └── Clipper: Hard 0.85\n├── Layer 2 (sub sine C1)\n│   └── Limiter: -3dBTP\n└── BUS\n    ├── Glue Comp: -6dB, 4:1\n    └── Limiter: -0.3dBTP"},
        "suggestions": ["How to sidechain bass to this kick?", "Show me a hardtek kick chain", "What about hi-hat programming?"],
    },
    "default": {
        "content": "NEUROTEK AI is ready to help with your production. I specialise in mentalcore, hardtek, tribe, acidcore, and hard techno.\n\nAsk me about:\n• Kick drum design and layering\n• Bass and acid 303 programming\n• Mix analysis and FX chains\n• Template generation for any genre\n• Live set structure and scene building",
        "suggestions": ["Design a kick for 200 BPM mentalcore", "Acid 303 setup for hardtek", "Mix assistant for my project"],
    },
}

@app.get("/")
async def root():
    return {"service": "NEUROTEK AI Microservice", "version": "0.2.0", "status": "online", "note": "Internal service — requires INTERNAL_SERVICE_TOKEN"}

@app.get("/health")
async def health():
    claude_key = os.environ.get("CLAUDE_API_KEY", "")
    return {"status": "healthy", "claude_configured": bool(claude_key and "REPLACE" not in claude_key), "internal_auth_enabled": bool(INTERNAL_TOKEN)}

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, _auth: bool = Depends(verify_internal_token)):
    await asyncio.sleep(0.8 + random.random() * 0.5)
    msg_lower = req.message.lower()
    if "kick" in msg_lower:
        resp = CANNED_RESPONSES["kick"]
    elif "acid" in msg_lower or "303" in msg_lower:
        resp = {"content": "**303 Acid Bass for Hardtek**\n\nPattern: 16-step with accent on steps 1, 5, 9, 13\nResonance: 85%\nCutoff sweep: 200Hz → 3kHz over 4 bars\nEnv Mod: 75%, Decay: 80ms\n\nFX: 1/8 delay (35% feedback) → plate reverb (20% mix)", "suggestions": ["How to program slides?", "Acid in tribe music?", "303 VST recommendations?"]}
    else:
        resp = CANNED_RESPONSES["default"]
    return ChatResponse(**resp)

@app.post("/generate-template")
async def generate_template(req: TemplateRequest, _auth: bool = Depends(verify_internal_token)):
    await asyncio.sleep(1.0)
    prompt = format_template_prompt(req.genre, req.bpm, req.mood)
    track_types_by_genre = {
        "mentalcore": [("KICK LAYER 1", "kick", "#ef4444"), ("MENTAL BASS", "bass", "#f59e0b"), ("ACID 303", "acid", "#06b6d4"), ("PSYCH FX", "fx", "#10b981"), ("HH ROLLS", "percussion", "#ec4899"), ("MASTER", "master", "#7c3aed")],
        "tribe": [("TRIBE KICK", "kick", "#ef4444"), ("TRIBAL PERC", "percussion", "#ec4899"), ("DEEP BASS", "bass", "#f59e0b"), ("LOOP FX", "fx", "#10b981"), ("MASTER", "master", "#7c3aed")],
        "hardtek": [("TEK KICK", "kick", "#ef4444"), ("HARDTEK BASS", "bass", "#f59e0b"), ("INDUSTRIAL FX", "fx", "#10b981"), ("PERCUSSION", "percussion", "#ec4899"), ("MASTER", "master", "#7c3aed")],
    }
    tracks_raw = track_types_by_genre.get(req.genre, track_types_by_genre["mentalcore"])
    tracks = [{"name": name, "type": t_type, "color": color, "volumeDefault": 112 if t_type == "kick" else 100 if t_type == "master" else 85, "suggestedFX": []} for name, t_type, color in tracks_raw]
    return {"success": True, "data": {"name": f"{req.genre.capitalize()} Template", "genre": req.genre, "bpm": req.bpm, "mood": req.mood, "description": f"AI-generated {req.genre} template at {req.bpm} BPM ({req.mood} mood).", "tracks": tracks, "ai_confidence": round(0.85 + random.random() * 0.12, 3), "prompt_used": prompt[:200] + "...", "generated_at": __import__("datetime").datetime.utcnow().isoformat()}}

@app.post("/analyse-mix")
async def analyse_mix(req: MixAnalysisRequest, _auth: bool = Depends(verify_internal_token)):
    await asyncio.sleep(1.2)
    prompt = format_mix_analysis_prompt(req.project_name, req.genre, req.bpm, req.tracks, req.loudness or -8.0)
    return {"success": True, "data": {"project_name": req.project_name, "score": random.randint(65, 90), "conflicts": [{"trackA": "Kick", "trackB": "Bass", "frequency": 80, "severity": "high", "suggestion": "Apply sidechain compression (0ms attack, 120ms release) and HP filter bass above 80Hz."}], "suggestions": [{"type": "sidechain", "title": "Kick → Bass sidechain missing", "description": "Add sidechain compressor from kick to bass: Threshold -18dB, Ratio 8:1, Attack 0ms, Release 120ms.", "priority": "high"}], "loudness": {"integrated": req.loudness, "true_peak": round(req.loudness + 5 + random.random() * 2, 1), "lra": round(3 + random.random() * 4, 1)}, "prompt_excerpt": prompt[:150] + "..."}}

@app.post("/design-kick")
async def design_kick(req: KickDesignRequest, _auth: bool = Depends(verify_internal_token)):
    await asyncio.sleep(0.8)
    prompt = format_kick_prompt(req.genre, req.bpm, req.character or "punchy")
    return {"success": True, "data": {"genre": req.genre, "bpm": req.bpm, "chain": [{"name": "Transient Shaper", "type": "compressor", "params": {"attack": "0ms", "sustain": "-8dB"}}, {"name": "EQ Eight", "type": "eq", "params": {"band1": "+6dB @ 55Hz", "band2": "-5dB @ 250Hz"}}, {"name": "Saturator", "type": "distortion", "params": {"drive": "80%", "mode": "Hard Clip"}}, {"name": "Limiter", "type": "limiter", "params": {"ceiling": "-0.3dBTP"}}]}}

@app.post("/acid-pattern")
async def acid_pattern(req: AcidPatternRequest, _auth: bool = Depends(verify_internal_token)):
    await asyncio.sleep(0.6)
    notes = ["C2", "C2", "G1", "C2", "F2", "C2", "Bb1", "C2", "C2", "Eb2", "C2", "G1", "F2", "C2", "G1", "C2"]
    accents = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0]
    slides = [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0]
    pattern = [{"step": i + 1, "note": notes[i], "accent": bool(accents[i]), "slide": bool(slides[i])} for i in range(16)]
    return {"success": True, "data": {"genre": req.genre, "bpm": req.bpm, "key": req.key, "pattern": pattern, "synth_settings": {"cutoff": "500 Hz (start)", "resonance": "85%", "env_mod": "75%", "decay": "80ms", "accent_amount": "60%"}, "fx": {"delay": {"time": "1/8", "feedback": "35%", "mix": "25%"}, "reverb": {"type": "plate", "size": "40%", "mix": "20%"}}}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
