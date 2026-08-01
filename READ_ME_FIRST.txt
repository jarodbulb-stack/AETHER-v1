AETHER V2.0 — VOICE SYSTEM, COMPLETE & FINAL (all fixes merged)
================================================================
4 files, this is the ONLY voice zip you need now — supersedes the
three separate deliveries that came before it (Jarvis rebuild, audio-
timing fix, male-voice fix). All three are merged into these 4 files.

FILES + CHECKSUMS (so you can confirm you have exactly these, via
Notepad or any checksum tool, if anything seems off again):
  aether-voice.js     953c644c3d688d3c5f5590523a4671e8
  loading.html        c1d7bcde69af9dc6ab07558126876e8c
  dashboard.html      d0e5b986277d05efa2331f8a93209559
  command-center.html 51914cb1f10a3f85d5d79b3a48777396

EVERYTHING THIS INCLUDES
- Splash -> login: "Welcome back, Dan. Systems online, initializing."
- Login -> dashboard: "Connecting to AETHER." then "Connection
  established. Standing by for your command." (sequenced, matching
  on-screen text)
- Command Deck, first visit this session: reads the real daily quote
  aloud, once
- Command Deck, return visits: "What are you going to do now, sir?"
  or a reminder naming today's still-pending command
- Sign out: progress bar replaced entirely with "DATA SECURED / Until
  next time, sir." on screen, speaks "Data secured. Until next time,
  sir. Signing out.", then returns to the splash page
- Mission complete: "Mission complete. Another hard peak conquered.
  Well done, sir. Would you like to conquer another?" plus 3 more
  Jarvis-toned variants in rotation
- Domain complete: "Domain conquered, sir. That mountain is yours
  now." plus 2 more variants, each naming the real domain
- Jarvis tone throughout -- "Dan" once on arrival, "sir" everywhere
  after
- MALE voice selection, fixed -- the earlier bug (a female voice
  mistakenly in the "safe fallback" list) is corrected; picks a real
  male voice on Windows/macOS/Chrome whenever one is installed
- Audio reliability fixes -- short warm-up delay so lines don't get
  silently dropped on a fresh page load (a known Chrome quirk), plus
  a keep-alive nudge so longer lines like the quote don't cut off
  mid-sentence

INSTALL
Copy all 4 files into AETHER_MASTER_v2.0, overwrite. Hard-refresh
(Ctrl+Shift+R) or use Incognito to guarantee no cached old copies are
still being served.

STILL OPEN: THE LOGIN-SKIP QUESTION
I checked login.html and firebase-config.js thoroughly -- there is no
code in either that auto-skips the login form. The most likely
explanation is that your browser is still holding an authenticated
Firebase session from our testing earlier (it persists across
browser restarts by default on the same browser), which can make it
look like login got skipped. Testing the ENTER button in an
Incognito/Private window would confirm this definitively -- that
mode never carries an existing session, so if login still gets
skipped there too, that tells us it's a real code issue rather than
a leftover session, and I'll dig further.
