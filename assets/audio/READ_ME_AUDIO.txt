AETHER — SOUNDTRACK FILES
==========================

Drop your own instrumental tracks into this folder using these EXACT
filenames (all lowercase, .mp3). The app is already wired to look for
them — nothing else to configure once they're here.

1. intro.mp3
   Plays when you click ENTER on the splash page. Continues across the
   loading screen and into the login page, then fades out and stops.
   Suggested length: 10-15 seconds is plenty — it fades out automatically
   around the 8 second mark by default (tunable in aether-music.js,
   look for SPLASH_FADE_START_SEC near the top).

2. dashboard-intro.mp3
   Plays fresh every time you land on the Command Deck. Plays for about
   6 seconds, then fades out and stops. Suggested length: 8-10 seconds.
   Tunable via DASH_FADE_START_SEC in aether-music.js.

3. celebration-loop.mp3
   Starts right after the mission-complete chime finishes, and LOOPS
   continuously until you click any of the three exit buttons on that
   screen (Next Mission / Summit Archive / Return to Dashboard) or
   click outside the card. This one should be edited so it loops
   seamlessly (no click or gap at the seam) — how "clean" this sounds
   depends entirely on how the file itself is edited, not the code.

FORMAT NOTES
- .mp3 works everywhere. If you'd rather use .ogg or .m4a, open
  aether-music.js and change the file extensions in the TRACKS object
  near the top — everything else stays the same.
- Keep files reasonably small (mono, 96-128kbps is plenty for
  background music) — a few hundred KB to ~2MB per track is a good
  target so the app stays light.
- If a file is missing, that particular moment just stays silent —
  nothing breaks. You can add these one at a time and test as you go.

A NOTE ON AUTOPLAY
Browsers block audio-with-sound from starting on its own unless the
user has clicked something on that page first. The splash intro is
fine (ENTER is a direct click). The Command Deck intro is the one
that's most exposed to this — most of the time it'll play fine since
you clicked your way there, but on some browsers/settings it may not
autoplay the very first time. That's a browser policy, not something
fixable from the app's code.

SOUNDTRACK LIBRARY (Command Center — built now)
You no longer have to manually drop files in this folder if you don't
want to. Command Center → Soundtrack Library lets you upload, replace,
and preview each of the 3 tracks above directly from your device's own
file/music picker (works the same way on a phone as it does on a
desktop). Uploaded tracks are stored inside the app itself and take
priority over the files in this folder automatically. The files here
still work as the default/fallback if nothing's been uploaded yet.
