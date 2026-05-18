# NeuroTek AI — v1.0.0-beta.1 Launch Checklist

**Target launch date:** May 14, 2025  
**Release manager:** Check off each item before proceeding to the next phase.

---

## Phase 1 — Pre-Launch QA

### Build verification
- [ ] `cd frontend && npx tsc --noEmit` → zero errors
- [ ] `cd website && npx tsc --noEmit` → zero errors
- [ ] `cd frontend && npm run build` → exits 0
- [ ] `cd website && npm run build` → exits 0
- [ ] Electron build completes: `cd electron && npm run build`
- [ ] Installer `.exe` launches on clean Windows 10 VM
- [ ] Installer `.exe` launches on clean Windows 11 machine
- [ ] Portable `.exe` runs without install on Windows 10
- [ ] SHA-256 checksums recorded for both artifacts

### Core DAW functionality
- [ ] Piano Roll opens, notes can be placed and deleted
- [ ] Playback plays audio through default Windows audio device
- [ ] Playback works via ASIO if ASIO device is present
- [ ] Arrangement Timeline plays back clips in sequence
- [ ] Mixer faders affect output level
- [ ] Sample Browser loads and previews a sample
- [ ] Project saves and reopens correctly (File → Save / Open)
- [ ] WAV export produces a valid stereo file
- [ ] MIDI export produces a valid `.mid` file

### AI generation
- [ ] Text prompt → pattern is generated and inserted into Piano Roll
- [ ] Chord suggestion generates and is inserted
- [ ] Rate limit is enforced at 10/month on Free tier
- [ ] Error message shown gracefully when quota is exceeded
- [ ] Offline: AI generation shows "requires internet" message, DAW still works

### Auth & account
- [ ] Sign-up flow creates account and redirects to app
- [ ] Sign-in with correct credentials succeeds
- [ ] Sign-in with wrong password shows error (not a crash)
- [ ] Password reset email is sent (test with real email)
- [ ] Discord OAuth sign-in works
- [ ] Account page shows correct plan and usage

### Website
- [ ] Landing page loads at https://neurotek.ai
- [ ] `/download` download buttons resolve to real GitHub release URLs
- [ ] `/pricing` plan cards display correctly
- [ ] `/changelog` renders v1.0.0-beta.1 entry
- [ ] `/support` FAQ accordion opens and closes
- [ ] `/login` sign-in and sign-up tabs work
- [ ] `/privacy` page renders all 11 sections
- [ ] `/terms` page renders all 15 sections
- [ ] Footer Legal / Community / Resources links all resolve (no `href="#"` remaining)
- [ ] Mobile layout (375px) — no horizontal overflow on Landing, Download, Pricing
- [ ] Open Graph preview renders correctly (use https://opengraph.xyz or similar)

---

## Phase 2 — GitHub Release Steps

1. **Tag the release**
   ```bash
   git tag -a v1.0.0-beta.1 -m "v1.0.0-beta.1 — first public beta"
   git push origin v1.0.0-beta.1
   ```

2. **Create GitHub Release**
   - Go to https://github.com/mixpiloteai-oss/mixpiloteai/releases/new
   - Tag: `v1.0.0-beta.1`
   - Title: `v1.0.0-beta.1 — First Public Beta`
   - Mark as **Pre-release**
   - Paste content from `RELEASE_NOTES.md` into the description

3. **Upload artifacts**
   - `NeuroTek-AI-Setup-1.0.0-beta.1.exe`
   - `NeuroTek-AI-Portable-1.0.0-beta.1.exe`
   - Wait for upload to complete before publishing

4. **Add checksums**
   - Run `certutil -hashfile NeuroTek-AI-Setup-1.0.0-beta.1.exe SHA256`
   - Add both SHA-256 values to the release description

5. **Publish the release** — uncheck "Pre-release" if ready for full public, or leave checked for beta

---

## Phase 3 — Website Deploy Order

Deploy in this exact order to avoid broken links before the release is live:

1. Push all website changes to `main` / your deploy branch
2. Trigger Vercel deployment — wait for "Ready" status
3. Smoke-test https://neurotek.ai/download → confirm download buttons point to the new tag
4. Verify https://neurotek.ai/changelog shows v1.0.0-beta.1
5. Upload GitHub release artifacts (Phase 2 step 3)
6. Re-verify download links now resolve to actual files (not 404)

---

## Phase 4 — Beta Testing Checklist

### Internal (before public announcement)
- [ ] 3+ team members have installed and tested the full flow on real hardware
- [ ] At least one test on Windows 10 (not just Windows 11)
- [ ] Audio tested with: default Windows audio, WASAPI, ASIO4ALL
- [ ] At least one VST plugin scanned and loaded successfully
- [ ] Full project save → close → reopen → export cycle tested end-to-end
- [ ] AI generation tested at Free, Pro, and Studio quota levels

### External (first 48h after launch)
- [ ] Post in Discord #beta-testing with install link
- [ ] Ask 5–10 trusted community members to test and report issues
- [ ] Monitor GitHub Issues for crash reports (check every 4h for first day)
- [ ] Monitor Discord #bug-reports channel
- [ ] Triage all P0 (crash/data loss) issues within 2h

---

## Phase 5 — Post-Launch Monitoring Checklist

### First 2 hours
- [ ] Vercel deployment is green (no build errors)
- [ ] Website responds with 200 on all main routes
- [ ] GitHub release page accessible, artifacts downloadable
- [ ] Backend health endpoint returns 200: `GET /health`
- [ ] AI service health endpoint returns 200: `GET /health`
- [ ] No spike in error logs (Sentry / console)

### First 24 hours
- [ ] Monitor GitHub Issues — triage all new reports
- [ ] Monitor Discord for first user feedback
- [ ] Check download analytics (GitHub release download count)
- [ ] Verify no authentication outages
- [ ] Review backend error logs for unusual patterns (quota abuse, auth failures)
- [ ] Check AI generation success rate (target >95%)

### First 7 days
- [ ] Daily: review new GitHub issues, respond within 24h
- [ ] Daily: check Discord for unanswered questions
- [ ] Review top requested features — update roadmap accordingly
- [ ] Post "Week 1 update" in Discord with metrics + what's being fixed
- [ ] Plan beta.2 scope based on feedback

---

## Phase 6 — Rollback Plan

### Website rollback
If the Vercel deployment introduces a regression:
1. Go to Vercel dashboard → Deployments
2. Find the last known-good deployment
3. Click "Promote to Production"
4. Estimated time: < 2 minutes

### GitHub Release rollback
If an artifact is corrupted or causes crashes:
1. Edit the release → uncheck "Latest release" → save
2. Do NOT delete the release (preserves issue references)
3. Upload a hotfix build as a new release `v1.0.0-beta.1-hotfix-1`
4. Update the website Download page to point to the hotfix release URL
5. Post in Discord pinning the hotfix with details

### Backend/AI service rollback
1. Identify the last stable Git SHA: `git log --oneline -10`
2. Deploy the previous SHA to your hosting environment
3. Verify health endpoints return 200 before announcing all-clear
4. Open a post-mortem issue on GitHub within 24h

### P0 emergency contacts
- Backend down: check server logs, restart service, escalate to infra
- AI quota exhausted: check Anthropic dashboard, increase limit or throttle requests
- Database corruption: restore from last backup, post status update immediately

---

## Launch Announcement Checklist

- [ ] Discord announcement in #announcements with download link and release notes link
- [ ] GitHub Release published (see Phase 2)
- [ ] Twitter/X post with OG image and download link
- [ ] Update README.md badges to reflect live version
- [ ] Pin announcement in Discord for 7 days

---

## Notes

- SmartScreen warning is expected on first install — installer is not yet code-signed. Users must click "More info → Run anyway". This is documented in `/download` and in the Release Notes.
- macOS and Linux are not available yet. Discord channel `#platform-requests` is collecting interest.
- The `og-image.png` for social previews needs to be created and uploaded to `website/public/og-image.png` before the website deploy.
