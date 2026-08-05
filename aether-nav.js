/* ============================================================
   AETHER PAGE NAVIGATION — Back / Continue bar
   Adds a fixed bottom bar with Back (previous page in sidebar order)
   and Continue (next page). Auto-detects current page from the URL.
   Drop <script src="aether-nav.js"></script> before </body> on each page.
   ============================================================ */
(function(){
  'use strict';

  // Sidebar order (must match the nav). Each: {file, label}
  var ORDER = [
    { file: 'dashboard.html',         label: 'Command Deck' },
    { file: 'life-advancement.html',  label: 'Life Advancement' },
    { file: 'missions.html',          label: 'Missions' },
    { file: 'blueprints.html',        label: 'Blueprints' },
    { file: 'problems-blockers.html', label: 'Problems / Blockers' },
    { file: 'evidence-vault.html',    label: 'Evidence Vault' },
    { file: 'timeline.html',          label: 'Timeline' },
    { file: 'debrief.html',           label: 'Debrief' },
    { file: 'knowledge-library.html', label: 'Knowledge Library' },
    { file: 'summit-archive.html',    label: 'Summit Archive' },
    { file: 'command-center.html',    label: 'Command Center' }
  ];

  function currentFile(){
    var path = (window.location.pathname || '').split('/').pop();
    if(!path) return 'dashboard.html';
    // Some setups (npx serve, clean-URL hosting, or just typing the URL
    // without the extension) present the path without ".html". Normalize
    // so page detection still matches the ORDER list either way.
    if(path.indexOf('.') === -1) path += '.html';
    return path;
  }

  function build(){
    var cur = currentFile();
    var idx = -1;
    for(var i=0;i<ORDER.length;i++){ if(ORDER[i].file === cur){ idx = i; break; } }
    if(idx === -1) return; // page not in the flow (e.g. login/index) -> no bar

    var prev = idx > 0 ? ORDER[idx-1] : null;
    var next = idx < ORDER.length-1 ? ORDER[idx+1] : null;

    // styles
    var css = document.createElement('style');
    css.textContent =
      '.aether-navbar{position:fixed;left:0;right:0;bottom:0;z-index:9000;'+
        'display:flex;align-items:center;justify-content:space-between;gap:12px;'+
        'padding:10px 20px;background:rgba(8,12,20,0.92);backdrop-filter:blur(8px);'+
        'border-top:1px solid rgba(120,150,200,0.18);transition:left var(--transition,0.2s);}'+
      '.aether-navbtn{display:inline-flex;align-items:center;gap:8px;'+
        'font-family:var(--font-mono,monospace);font-size:12px;letter-spacing:0.04em;'+
        'color:#cfe0ff;text-decoration:none;padding:9px 16px;border-radius:8px;'+
        'border:1px solid rgba(120,150,200,0.25);background:rgba(30,46,78,0.5);'+
        'transition:background .15s,border-color .15s,transform .1s;cursor:pointer;}'+
      '.aether-navbtn:hover{background:rgba(60,90,150,0.55);border-color:rgba(150,180,230,0.5);}'+
      '.aether-navbtn:active{transform:translateY(1px);}'+
      '.aether-navbtn.disabled{opacity:0.3;pointer-events:none;}'+
      '.aether-navbtn .sub{opacity:0.6;font-size:10px;}'+
      '.aether-navbar .progress{flex:1;text-align:center;font-family:var(--font-mono,monospace);'+
        'font-size:10px;letter-spacing:0.1em;color:rgba(180,200,240,0.5);}'+
      // give pages breathing room so the bar never covers content
      'body{padding-bottom:64px;}';
    document.head.appendChild(css);

    var bar = document.createElement('div');
    bar.className = 'aether-navbar';

    // Back
    var backHtml = prev
      ? '<a class="aether-navbtn" href="'+prev.file+'"><span>&larr;</span>'+
          '<span>Back<span class="sub"> · '+prev.label+'</span></span></a>'
      : '<span class="aether-navbtn disabled"><span>&larr;</span><span>Back</span></span>';

    // progress indicator
    var prog = '<div class="progress">'+(idx+1)+' / '+ORDER.length+' · '+ORDER[idx].label.toUpperCase()+'</div>';

    // Continue
    var nextHtml = next
      ? '<a class="aether-navbtn" href="'+next.file+'"><span>Continue<span class="sub"> · '+next.label+'</span></span><span>&rarr;</span></a>'
      : '<span class="aether-navbtn disabled"><span>Continue</span><span>&rarr;</span></span>';

    bar.innerHTML = backHtml + prog + nextHtml;
    document.body.appendChild(bar);

    /* The bar is fixed to the viewport, but the sidebar is also fixed-
       height (100vh) with its own real content (nav links, operator
       profile, the mission quote at the very bottom). Left at 0, this
       bar physically covers the bottom of the sidebar on any window
       shorter than ~950px — which is most real browser windows once
       you subtract browser chrome. Push the bar's left edge to start
       exactly where the sidebar ends, so it only ever overlaps the
       main content column, never the sidebar. Recomputed on resize
       and whenever the sidebar's collapsed state changes, since both
       change the sidebar's real rendered width. On narrow/mobile
       layouts the sidebar becomes an off-canvas drawer (position:
       fixed, translated off-screen) rather than taking layout space,
       so the bar correctly spans full width there. */
    function updateBarPosition(){
      var sidebar = document.querySelector('.sidebar');
      if(!sidebar || window.innerWidth <= 900){
        bar.style.left = '0';
        return;
      }
      var w = sidebar.getBoundingClientRect().width;
      bar.style.left = w + 'px';
    }
    updateBarPosition();
    window.addEventListener('resize', updateBarPosition);
    var sidebarEl = document.querySelector('.sidebar');
    if(sidebarEl && window.MutationObserver){
      new MutationObserver(updateBarPosition).observe(sidebarEl, {attributes:true, attributeFilter:['class']});
    }
  }

  /* Sidebar "Summits" stat — a real summit is any mission whose
     progress has actually reached 100%. This mirrors exactly the
     same condition Summit Archive itself uses (mission.pct >= 100),
     so the sidebar number and the Summit Archive page can never
     disagree. Runs on every page since every page shares this
     sidebar stat. */
  function syncSummitsCount(){
    var el = document.getElementById('sidebarSummits');
    if(!el || typeof AetherStore === 'undefined') return;
    var missions = AetherStore.getAllMissions ? AetherStore.getAllMissions() : [];
    var summited = missions.filter(function(m){ return m.pct >= 100; }).length;
    el.textContent = summited;
  }

  /* Sign Out — appended to the bottom of the sidebar profile card on
     every page that includes this script. Routes back through the
     loading transition to index.html rather than jumping straight
     there, matching the "connecting" ceremony used on the way in. */
  function addSignOut(){
    var profile = document.querySelector('.sidebar-profile');
    if(!profile || document.getElementById('aetherSignOutBtn')) return;

    var css = document.createElement('style');
    css.textContent =
      '.aether-signout{display:flex;align-items:center;gap:8px;'+
        'margin-top:10px;padding:9px 10px;border-radius:8px;cursor:pointer;'+
        'font-family:var(--font-mono,monospace);font-size:11px;letter-spacing:0.06em;'+
        'color:rgba(255,140,150,0.75);border:1px solid rgba(255,92,108,0.2);'+
        'background:rgba(255,92,108,0.06);transition:background .15s,border-color .15s,color .15s;}'+
      '.aether-signout:hover{background:rgba(255,92,108,0.14);border-color:rgba(255,92,108,0.4);color:#ff8c96;}'+
      '.aether-signout svg{width:14px;height:14px;flex-shrink:0;}';
    document.head.appendChild(css);

    var btn = document.createElement('div');
    btn.id = 'aetherSignOutBtn';
    btn.className = 'aether-signout';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '+
        'stroke-linecap="round" stroke-linejoin="round">'+
        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>'+
        '<polyline points="16 17 21 12 16 7"/>'+
        '<line x1="21" y1="12" x2="9" y2="12"/>'+
      '</svg><span>Sign Out</span>';
    btn.addEventListener('click', function(){
      var goToIndex = function(){
        window.location.href = 'loading.html?next=index.html&mode=signout&label=CLOSING%20SESSION&sub=Securing%20your%20data%E2%80%A6&min=1100';
      };
      // End the real Firebase session before leaving. If Firebase isn't
      // reachable for some reason, still navigate away rather than
      // trapping the operator on the page.
      import('./firebase-config.js').then(function(cfg){
        import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js').then(function(authSdk){
          authSdk.signOut(cfg.auth).then(goToIndex).catch(goToIndex);
        }).catch(goToIndex);
      }).catch(goToIndex);
    });
    profile.appendChild(btn);
  }

  /* Voice: gives every page something to say on arrival, centrally --
     no per-page wiring needed. Command Deck (dashboard.html) is
     skipped here because it already runs its own richer flow (quote,
     then a named reminder or a standby prompt) directly in
     dashboard.html. Everywhere else just gets the guaranteed daily
     quote (if nobody's heard it yet today) or a short, page-
     appropriate ambient line. */
  function announcePageVoice(){
    if(!window.AetherVoice) return;
    var cur = currentFile();
    if(cur === 'dashboard.html') return;
    var quoteEl = document.querySelector('.profile-quote');
    var quoteText = (quoteEl && quoteEl.textContent.trim()) ? quoteEl.textContent.trim() : null;
    window.AetherVoice.announcePageArrival(cur, quoteText);
  }

  /* Background music: unlike voice, Command Deck is NOT a special case
     here -- every page, including it, just plays whatever ambient loop
     has been assigned to it (see Command Center's "Page Backgrounds"
     panel), or stays silent if nothing has. */
  function announcePageMusic(){
    if(!window.AetherMusic) return;
    window.AetherMusic.playPageLoop(currentFile());
  }

  /* Mobile menu: aether-shell.css already hid the sidebar off-screen
     under 900px width, but nothing ever brought it back -- there was
     no button anywhere to trigger the .mobile-open class that CSS was
     waiting for. This builds that missing button once, here, so every
     page that loads aether-nav.js gets it automatically. */
  var HAMBURGER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
  var CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function buildMobileMenu(){
    var sidebar = document.getElementById('sidebar');
    if(!sidebar || document.querySelector('.mobile-menu-btn')) return; // no sidebar on this page, or already built

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mobile-menu-btn';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = HAMBURGER_ICON;

    var backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';

    function closeMenu(){
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('open');
      btn.innerHTML = HAMBURGER_ICON;
      btn.setAttribute('aria-label', 'Open menu');
    }
    function openMenu(){
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('open');
      btn.innerHTML = CLOSE_ICON;
      btn.setAttribute('aria-label', 'Close menu');
    }
    btn.addEventListener('click', function(){
      if(sidebar.classList.contains('mobile-open')) closeMenu(); else openMenu();
    });
    backdrop.addEventListener('click', closeMenu);

    /* Tapping any actual nav link inside the sidebar should close the
       drawer too -- without this, navigating on mobile briefly shows
       the new page underneath a still-open sidebar until the next
       page's own script re-runs this whole setup fresh. */
    sidebar.addEventListener('click', function(e){
      if(e.target.closest('a')) closeMenu();
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(btn);
  }

  /* Persistent Help button: a small "?" fixed bottom-right on every
     page that loads aether-nav.js, linking to the new guide.html.
     Skipped on the guide page itself, since a help button pointing to
     the page you're already on is just clutter. */
  function buildHelpButton(){
    if(currentFile() === 'guide.html' || document.querySelector('.help-btn')) return;
    var btn = document.createElement('a');
    btn.href = 'guide.html';
    btn.className = 'help-btn';
    btn.setAttribute('aria-label', 'How to use AETHER');
    btn.title = 'How to use AETHER';
    btn.textContent = '?';
    document.body.appendChild(btn);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', build);
    document.addEventListener('DOMContentLoaded', syncSummitsCount);
    document.addEventListener('DOMContentLoaded', addSignOut);
    document.addEventListener('DOMContentLoaded', announcePageVoice);
    document.addEventListener('DOMContentLoaded', announcePageMusic);
    document.addEventListener('DOMContentLoaded', buildMobileMenu);
    document.addEventListener('DOMContentLoaded', buildHelpButton);
  } else {
    build();
    syncSummitsCount();
    addSignOut();
    announcePageVoice();
    announcePageMusic();
    buildMobileMenu();
    buildHelpButton();
  }
})();
