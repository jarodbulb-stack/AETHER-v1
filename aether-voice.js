/* ============================================================
   AETHER — VOICE  (v3: house-wide, with pre-speech chime)
   A butler, not a robot. Understated, courteous, dry — closer to
   Jarvis than a mission-control computer. Uses the browser's built-in
   Web Speech API (speechSynthesis) -- no external service, no API
   key, works offline, same "synthesized locally" philosophy as the
   fanfare in aether-celebration.js.

   ADDRESS: "Dan" on arrival (the personal, first-line-of-the-day
   greeting); "sir" used sparingly everywhere else.

   Web Audio chime (see playChime) -- a soft two-tone bell plays right
   before every spoken line. Two jobs at once: it's an audio cue that
   AETHER is about to say something, and its short tail gives the
   speech engine a beat to actually be ready before the first word
   starts, which is what was clipping first words. The chime genuinely
   waits for the audio context to be running (not a flat timer fired
   in parallel with an unresolved resume()) before scheduling itself
   and before the countdown to speech -- that's what fixed the chime
   sometimes being heard AFTER speech had already started.

   WHAT'S IN THIS VERSION
   - Every transition (init/arrival/connected/signout) has a small
     pool of paired {title, sub, voice} variants instead of one fixed
     line each -- screen text and speech always match each other, they
     just vary together. loading.html calls announceTransition(mode)
     and uses the returned title/sub.
   - mode is passed explicitly (?mode=init|arrival|signout) by every
     caller, instead of being guessed from the "next" filename -- this
     is what fixed sign-out sometimes announcing "Connecting to
     AETHER" instead of "Data secured."
   - The daily quote gate is a real calendar-day gate stored in
     localStorage (aetherQuoteLastDate, deliberately NOT prefixed
     "aether_" so firestore-sync.js doesn't mirror it to the cloud as
     campaign data). Guaranteed once every calendar day, on whichever
     page is opened first that day.
   - Every page has something to say. PAGE_LINES holds a small
     ambient-comment pool per page, spoken with a natural (not 100%)
     chance on arrival. aether-nav.js calls
     AetherVoice.announcePageArrival(pageKey, quoteTextOrNull)
     centrally so no page has to wire it individually.
   - Command Deck keeps its own richer flow (quote, then a reliable
     named reminder when a command is pending, else a standby prompt)
     via AetherVoice.dashboardArrival(...).
   - confirmAction(kind, extra) speaks short, natural confirmations for
     real actions (backups, exports/imports, blueprint saves, bulk
     paste, evidence logged) rather than reading raw toast text aloud.
   - "sir" is used sparingly throughout (roughly one line in three or
     four), not on nearly every line.
   - Ducks under background music: on utterance start/end, calls
     window.AetherMusic.duck()/unduck() if that module is present.

   Usage:
     AetherVoice.announceTransition(mode) -> {title, sub}  -- mode:
       'init' | 'arrival' | 'connected' | 'signout'  (loading.html)
     AetherVoice.announceLoginArrival()   -- login.html
     AetherVoice.dashboardArrival(quoteText, hasPendingCommand, commandTitle)
     AetherVoice.announcePageArrival(pageKey, quoteTextOrNull, opts?)
     AetherVoice.confirmAction(kind, extra?)
     AetherVoice.congratulateMission(name)
     AetherVoice.congratulateDomain(name)
     AetherVoice.setEnabled(true|false)   -- persisted mute toggle
     AetherVoice.isEnabled()

   Voice defaults ON -- setEnabled(false) mutes it persistently, from
   either the sidebar toggle or the Command Center Preferences panel
   (both read/write the same stored state). Some browsers restrict
   audio that isn't triggered by a direct user gesture; if a line
   doesn't play in that situation, speak() fails silently rather than
   breaking anything.
   ============================================================ */
(function(){
  'use strict';

  var STORAGE_KEY = 'aetherVoiceEnabled'; /* deliberately NOT "aether_..." --
    firestore-sync.js mirrors any "aether_" key to the cloud as campaign
    data, and voice mute is a local device preference, not campaign data */
  var chosenVoice = null;

  function isEnabled(){
    try{
      var v = localStorage.getItem(STORAGE_KEY);
      return v === null ? true : v === 'true';
    }catch(e){ return true; }
  }
  function setEnabled(on){
    try{ localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false'); }catch(e){}
    if(!on && window.speechSynthesis) window.speechSynthesis.cancel();
  }

  /* Pick a calm, deep, unmistakably male voice once the browser's
     voice list is ready (loads asynchronously in most browsers). */
  var MALE_VOICE_NAMES = [
    'Google UK English Male',
    'Microsoft David Desktop','Microsoft David','Microsoft Mark','Microsoft James','Microsoft George','Microsoft Ravi','Microsoft Guy',
    'Daniel','Alex','Fred','Gordon','Oliver','Aaron',
    'Bahh (English (America))'
  ];
  var FEMALE_HINTS = /female|zira|hazel|susan|catherine|linda|samantha|victoria|karen|moira|tessa|fiona|serena|allison|ava|siri/i;
  var MALE_HINTS = /male|david|mark|james|george|ravi|guy|daniel|alex(?!a)|fred|gordon|oliver|aaron/i;

  function pickVoice(){
    if(!window.speechSynthesis) return;
    var voices = window.speechSynthesis.getVoices();
    if(!voices || !voices.length) return;

    for(var i=0;i<MALE_VOICE_NAMES.length;i++){
      var m = voices.find(function(v){ return v.name === MALE_VOICE_NAMES[i]; });
      if(m){ chosenVoice = m; return; }
    }

    var enVoices = voices.filter(function(v){ return /^en/i.test(v.lang); });
    var maleGuess = enVoices.find(function(v){ return MALE_HINTS.test(v.name) && !FEMALE_HINTS.test(v.name); });
    if(maleGuess){ chosenVoice = maleGuess; return; }

    chosenVoice = enVoices[0] || voices[0];
  }
  if(window.speechSynthesis){
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  /* Chrome bug workaround: speechSynthesis silently stops mid-utterance
     after ~15s unless nudged. Keeps a pause/resume heartbeat going only
     while something is actually speaking. */
  var keepAliveTimer = null;
  function keepAlive(){
    if(keepAliveTimer) clearInterval(keepAliveTimer);
    keepAliveTimer = setInterval(function(){
      if(!window.speechSynthesis || !window.speechSynthesis.speaking){
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 9000);
  }

  /* ---- Chime: a soft two-tone bell played right before every spoken
     line. Two jobs at once: it's an audio cue that AETHER is about to
     say something, and its short tail gives the speech engine a beat
     to actually be ready before the first word starts -- which is
     what was clipping first words, especially right after a page
     loads. Pure Web Audio synthesis, no audio file needed. ---- */
  var audioCtx = null;
  function getAudioCtx(){
    if(!audioCtx){
      var AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      try{ audioCtx = new AC(); }catch(e){ return null; }
    }
    return audioCtx;
  }
  function playChime(onDone){
    var ctx = getAudioCtx();
    if(!ctx){ if(onDone) onDone(); return; }

    /* settled guards against the resume() promise and the safety-net
       timer below both firing -- whichever happens first wins, the
       other becomes a no-op. */
    var settled = false;
    function scheduleAndFinish(){
      if(settled) return;
      settled = true;
      try{
        /* currentTime is only meaningful once the context is actually
           running -- reading it before a needed resume() had finished
           is exactly what let the scheduled tones fall in the past and
           surface late, after the sentence had already started. */
        var now = ctx.currentTime;
        var master = ctx.createGain();
        master.gain.value = 0.16;
        master.connect(ctx.destination);
        [880, 1318.5].forEach(function(freq, i){
          var osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          var g = ctx.createGain();
          var peak = i === 0 ? 1 : 0.35;
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(peak, now + 0.015);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
          osc.connect(g);
          g.connect(master);
          osc.start(now);
          osc.stop(now + 0.4);
        });
      }catch(e){}
      if(onDone) setTimeout(onDone, 340);
    }

    if(ctx.state === 'suspended'){
      /* Safety net: if resume() ever hangs (rare, but possible under
         strict autoplay policies before any click has happened on the
         page), don't let speech wait on it forever -- proceed without
         the chime rather than staying silent. */
      setTimeout(scheduleAndFinish, 500);
      ctx.resume().then(scheduleAndFinish).catch(scheduleAndFinish);
    } else {
      scheduleAndFinish();
    }
  }

  function speak(text, opts){
    if(!isEnabled()) return;
    if(!window.speechSynthesis) return;
    opts = opts || {};

    function doSpeak(){
      try{
        if(!opts.queue) window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        var u = new SpeechSynthesisUtterance(text);
        if(chosenVoice) u.voice = chosenVoice;
        u.rate = opts.rate || 0.96;
        u.pitch = opts.pitch || 0.82;
        u.volume = opts.volume != null ? opts.volume : 0.85;
        if(window.AetherMusic){
          u.onstart = function(){ window.AetherMusic.duck(); };
          u.onend = function(){ window.AetherMusic.unduck(); };
          u.onerror = function(){ window.AetherMusic.unduck(); };
        }
        window.speechSynthesis.speak(u);
        keepAlive();
      }catch(e){ /* fail silent */ }
    }

    /* Chime first, then a short breath, then speak -- for every line,
       not just the first one on a page. Consistent cue, consistent
       protection against a clipped opening word. */
    playChime(function(){ setTimeout(doSpeak, 60); });
  }

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  /* ---- Transitions: paired {title, sub, voice}, chosen together ---- */
  var TRANSITIONS = {
    init: [
      { title:'WELCOME BACK, DAN', sub:'Systems online, initializing\u2026',
        voice:'Welcome back, Dan. Systems online, initializing.' },
      { title:'WELCOME BACK, DAN', sub:'Bringing everything online\u2026',
        voice:'Good to see you again, Dan. Bringing everything online.' },
      { title:'WELCOME BACK, DAN', sub:'Waking the mountain\u2026',
        voice:'Welcome back, Dan. Let\u2019s get you moving again.' }
    ],
    arrival: [ /* the "connecting" leg of login -> dashboard */
      { title:'CONNECTING TO AETHER', sub:'Syncing mission data\u2026',
        voice:'Connecting to AETHER.' },
      { title:'CONNECTING TO AETHER', sub:'Pulling up your progress\u2026',
        voice:'One moment. Linking up.' },
      { title:'CONNECTING TO AETHER', sub:'Reaching the summit servers\u2026',
        voice:'Reconnecting you now, sir.' },
      { title:'CONNECTING TO AETHER', sub:'Verifying your climb\u2026',
        voice:'Just a moment. Getting you back in.' }
    ],
    connected: [
      { title:'CONNECTION ESTABLISHED', sub:'Standing by for your command.',
        voice:'Connection established. Standing by for your command.' },
      { title:'CONNECTION ESTABLISHED', sub:'All systems ready, sir.',
        voice:'You\u2019re in, sir. All systems ready.' },
      { title:'CONNECTION ESTABLISHED', sub:'Everything\u2019s where you left it.',
        voice:'Connected. Everything is right where you left it.' }
    ],
    signout: [
      { title:'DATA SECURED', sub:'Until next time, sir.',
        voice:'Data secured. Until next time, sir. Signing out.' },
      { title:'DATA SECURED', sub:'Rest up.',
        voice:'Everything\u2019s saved. Rest up \u2014 the mountain will still be there.' },
      { title:'DATA SECURED', sub:'Session closed.',
        voice:'Session closed. Data secured.' }
    ]
  };

  /* mode: 'init' | 'arrival' | 'connected' | 'signout'.
     Returns the chosen {title, sub} so the caller (loading.html) can
     render on-screen text that always matches what was just spoken. */
  function announceTransition(mode){
    var pool = TRANSITIONS[mode] || TRANSITIONS.arrival;
    var variant = pick(pool);
    speak(variant.voice, mode === 'connected' ? {queue:true} : {});
    return { title: variant.title, sub: variant.sub };
  }

  /* ---- Login page itself: its own short line, separate from the
     "Welcome back, Dan" line that plays on the loading screen just
     before it. This guarantees the login step always has something
     spoken on it, even if the loading transition before it was brief. ---- */
  var LOGIN_LINES = [
    'Verify it\u2019s you, and we\u2019ll get moving.',
    'Whenever you\u2019re ready, sir.',
    'Sign in when ready.',
    'Standing by to bring you in.'
  ];
  function announceLoginArrival(){
    speak(pick(LOGIN_LINES));
  }

  /* ---- Daily quote: a real calendar-day gate (localStorage, not
     sessionStorage) -- guaranteed once every day, on whichever page
     happens to be opened first that day. Not "aether_..." so it stays
     local and doesn't get mirrored to Firestore by firestore-sync.js
     as if it were campaign data. ---- */
  var QUOTE_DATE_KEY = 'aetherQuoteLastDate';
  function todayStr(){
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }
  function quoteReadToday(){
    try{ return localStorage.getItem(QUOTE_DATE_KEY) === todayStr(); }catch(e){ return false; }
  }
  function markQuoteRead(){
    try{ localStorage.setItem(QUOTE_DATE_KEY, todayStr()); }catch(e){}
  }
  var QUOTE_LEADINS = [
    'Today\u2019s reading, sir:',
    'Something for today:',
    'Worth carrying with you today:',
    'Here\u2019s today\u2019s line:'
  ];
  function speakQuote(quoteText){
    if(!quoteText) return;
    speak(pick(QUOTE_LEADINS) + ' ' + quoteText);
    markQuoteRead();
  }

  /* ---- Command Deck: quote if not yet heard today, otherwise a
     reliable named reminder when a command is pending, otherwise a
     standby prompt. Always exactly one of these per visit. ---- */
  var RETURN_PROMPTS_PENDING = [
    'What are you going to do now, sir?',
    'Still standing by. Shall we begin?',
    'Awaiting your next move.'
  ];
  var RETURN_PROMPTS_REMINDER = [
    'A reminder, sir: your command for today is still',
    'You haven\u2019t yet accepted today\u2019s command:',
    'Still outstanding:'
  ];
  function promptReturn(hasPendingCommand, commandTitle){
    if(hasPendingCommand && commandTitle){
      speak(pick(RETURN_PROMPTS_REMINDER) + ' ' + commandTitle + '.');
    } else {
      speak(pick(RETURN_PROMPTS_PENDING));
    }
  }

  /* Deliberately no "already said this" tracking here -- the whole
     point is this keeps coming back every visit while a mission stays
     overdue, not just once. It only ever stops because the mission
     actually got finished (or its deadline got moved), never because
     it was said before. */
  var OVERDUE_LINES = [
    'Sir, {mission} is overdue. Strike while the iron\u2019s hot \u2014 let\u2019s close it out.',
    'Still waiting on {mission}, sir. That deadline\u2019s already passed \u2014 worth finishing today.',
    '{mission} missed its date, sir. No reason it can\u2019t still be won.'
  ];
  function announceOverdueMission(missionName){
    speak(pick(OVERDUE_LINES).replace('{mission}', missionName));
  }

  function dashboardArrival(quoteText, hasPendingCommand, commandTitle, overdueMissionName){
    if(!isEnabled()) return;
    if(quoteText && !quoteReadToday()){
      speakQuote(quoteText);
      return;
    }
    if(overdueMissionName){
      announceOverdueMission(overdueMissionName);
      return;
    }
    promptReturn(hasPendingCommand, commandTitle);
  }

  /* ---- Every other page: something to say on arrival. Priority is
     always: (1) the guaranteed daily quote if nobody's heard it yet
     today, whichever page that happens to be, then (2) a small,
     page-appropriate ambient line, spoken with a natural chance
     rather than every single visit so it doesn't get repetitive. ---- */
  var PAGE_LINES = {
    'life-advancement.html': [
      'Your mountains are right where you left them.',
      'Every domain here is a peak waiting on you.',
      'Take a look at how far each climb has come, sir.',
      'The whole range. Pick your line up it.'
    ],
    'missions.html': [
      'Your missions. Pick your next objective.',
      'Every one of these is a step toward a summit.',
      'Let\u2019s see what\u2019s worth conquering next, sir.',
      'Plenty of ground left to cover here.'
    ],
    'blueprints.html': [
      'Blueprints \u2014 the plans behind every climb.',
      'A good blueprint makes the mountain smaller.',
      'Templates ready whenever you need to plan the next ascent, sir.',
      'The plans are only as good as the climb.'
    ],
    'problems-blockers.html': [
      'Let\u2019s see what\u2019s standing in your way.',
      'Every blocker cleared is ground gained.',
      'Nothing here the mountain hasn\u2019t seen before, sir.',
      'Worth clearing these before they slow the climb.'
    ],
    'evidence-vault.html': [
      'The proof of your work lives here.',
      'Evidence Vault \u2014 everything you\u2019ve actually done.',
      'Nice to have receipts, sir. Let\u2019s see them.',
      'Every checkpoint you\u2019ve earned, kept safe here.'
    ],
    'timeline.html': [
      'The full climb, laid out in order.',
      'Your history \u2014 every step that got you here, sir.',
      'Worth a look back, now and then.',
      'The whole route, start to now.'
    ],
    'debrief.html': [
      'Time to reflect, sir.',
      'The debrief is where the real learning happens.',
      'A clear look back makes the next climb sharper.',
      'Nothing wasted if you actually look at it.'
    ],
    'knowledge-library.html': [
      'The library \u2014 everything you\u2019ve learned, kept safe.',
      'Knowledge worth keeping, right here.',
      'Sharpen the axe before the next climb, sir.',
      'Worth a browse when you\u2019ve got a moment.'
    ],
    'summit-archive.html': [
      'Every summit you\u2019ve claimed. Take a look.',
      'The Summit Archive \u2014 proof none of this was easy.',
      'These peaks are yours for good, sir.',
      'A quiet reminder of what you\u2019re capable of.'
    ],
    'command-center.html': [
      'Command Center. Adjust things to your liking.',
      'Systems and settings, all in one place.',
      'Let me know if you\u2019d like anything configured differently, sir.',
      'Everything\u2019s running as it should.'
    ]
  };
  function announcePageArrival(pageKey, quoteText, opts){
    if(!isEnabled()) return;
    opts = opts || {};
    if(quoteText && !quoteReadToday()){
      speakQuote(quoteText);
      return;
    }
    var pool = PAGE_LINES[pageKey];
    if(pool && pool.length){
      var chance = opts.chance != null ? opts.chance : 0.65;
      if(Math.random() < chance) speak(pick(pool));
    }
  }

  /* ---- Contextual: mission / domain conquest ---- */
  var MISSION_LINES = [
    'Mission complete. Another hard peak conquered. Well done, sir. Would you like to conquer another?',
    'Summit reached. That one is conquered for good. Shall we find the next one?',
    'Confirmed: mission summited. Impeccable work, sir.',
    'Another peak claimed. The mountain remembers this one.'
  ];
  var DOMAIN_LINES = [
    'Domain conquered, sir. That mountain is yours now.',
    'An entire domain summited. Real, lasting progress.',
    'That whole route is climbed. Well earned.'
  ];
  function congratulateMission(name){ speak(pick(MISSION_LINES)); }
  function congratulateDomain(name){
    speak(name ? pick(DOMAIN_LINES) + ' ' + name + '.' : pick(DOMAIN_LINES));
  }

  /* ---- Action confirmations: backups, exports/imports, blueprint
     saves, bulk-paste completions -- short, natural lines rather than
     reading raw toast text aloud (numbers/punctuation read awkwardly).
     Call AetherVoice.confirmAction('key', 'optional detail') right
     where the action actually succeeds. 'extra' is spoken plainly
     after the line, e.g. a count -- keep it short. ---- */
  var CONFIRM_LINES = {
    backupSaved:     ['Backup complete, sir.', 'Your data\u2019s backed up.', 'Backup saved.'],
    backupRestored:  ['Backup restored.', 'You\u2019re back to that saved point, sir.'],
    backupFailed:    ['Backup failed \u2014 worth checking storage permissions, sir.'],
    exportDone:      ['Export complete.', 'Your data\u2019s exported and ready.'],
    importDone:      ['Import complete, sir. Reloading now.', 'Campaign imported. Give it a moment.'],
    importFailed:    ['That file didn\u2019t import \u2014 it may not be valid.'],
    dataCleared:     ['Your real data has been cleared, sir.'],
    demoLoaded:      ['Demo data loaded.'],
    demoCleared:     ['Demo cleared. Back to your real campaign.'],
    blueprintSaved:  ['Blueprint saved, sir.', 'That blueprint\u2019s locked in.', 'Blueprint created and ready to execute.'],
    stepsAdded:      ['Steps added.', 'Got those in, sir.', 'Added to the checklist.'],
    evidenceSaved:   ['Evidence logged.', 'Got it, sir. Filed as evidence.', 'Evidence saved.'],
    evidenceBulkAdded: ['Evidence added.', 'Those are all logged, sir.', 'Batch added to the vault.'],
    portfolioReady:  ['Portfolio\u2019s ready, sir.', 'Your record\u2019s laid out and ready to print.', 'That\u2019s the whole climb, on paper.'],
    applicationSaved: ['Logged, sir.', 'Added to the list.', 'That one\u2019s on record now.']
  };
  function confirmAction(kind, extra){
    if(!isEnabled()) return;
    var pool = CONFIRM_LINES[kind];
    if(!pool || !pool.length) return;
    var line = pick(pool);
    speak(extra ? (line + ' ' + extra) : line);
  }

  window.AetherVoice = {
    speak: speak,
    announceTransition: announceTransition,
    announceLoginArrival: announceLoginArrival,
    dashboardArrival: dashboardArrival,
    announcePageArrival: announcePageArrival,
    speakQuote: speakQuote,
    promptReturn: promptReturn,
    congratulateMission: congratulateMission,
    congratulateDomain: congratulateDomain,
    confirmAction: confirmAction,
    isEnabled: isEnabled,
    setEnabled: setEnabled
  };
})();
