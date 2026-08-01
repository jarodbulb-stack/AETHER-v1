/* ============================================================
   AETHER — SUMMIT CELEBRATION
   A full-screen, self-contained "mission complete" moment.
   Canvas confetti, a glowing flag-plant on the mission's own
   generated mountain, an animated stat reveal, and a short
   synthesized fanfare (Web Audio API — no external audio file
   needed, works fully offline).

   Usage:
     AetherCelebration.show({
       missionName: 'AETHER v1.0',
       daysClimbing: 14,
       totalSteps: 19,
       evidenceCount: 19,
       confidencePct: 100,
       mountainOpts: { name, domain, steps, pct, style },  // optional, for MissionMountain
       onNextMission: function(){ window.location.href = 'missions.html'; }, // optional -- defaults to missions.html if omitted
       onArchive:  function(){ window.location.href = 'summit-archive.html'; },
       onContinue: function(){ window.location.href = 'dashboard.html'; }
     });

   The celebration stays up -- confetti gently bursting every ~2.2s,
   not a one-shot fade -- until the operator picks one of three exits:
   "Next Mission, Sir?" (primary CTA -> straight back to creating or
   continuing a mission), View Summit Archive, or Return to Dashboard.

   Only fires when a MISSION is fully complete (not just one
   blueprint of several) — the caller decides that; this module
   just renders the moment.
   ============================================================ */
(function(){
  'use strict';

  var injected = false;
  function injectStyles(){
    if(injected) return;
    injected = true;
    var css = document.createElement('style');
    css.textContent = `
      .as-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
        background:radial-gradient(ellipse at 50% 30%, rgba(30,46,90,0.55) 0%, rgba(4,7,13,0.96) 65%, rgba(2,4,8,0.99) 100%);
        opacity:0;transition:opacity .5s ease;}
      .as-overlay.show{opacity:1;}
      .as-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
      .as-card{position:relative;z-index:2;width:min(560px,92vw);max-height:90vh;overflow:auto;
        background:rgba(10,15,26,0.88);border:1px solid rgba(255,209,102,0.35);
        border-radius:20px;padding:36px 32px 28px;text-align:center;
        box-shadow:0 0 0 1px rgba(255,209,102,0.08), 0 30px 90px rgba(0,0,0,0.6), 0 0 120px rgba(255,209,102,0.12);
        transform:translateY(24px) scale(0.96);opacity:0;transition:transform .6s cubic-bezier(.2,.9,.25,1), opacity .6s ease;}
      .as-overlay.show .as-card{transform:translateY(0) scale(1);opacity:1;}
      .as-mountain{width:100%;height:180px;margin:0 auto 6px;position:relative;}
      .as-flag{position:absolute;left:50%;top:6%;transform:translate(-50%,-100%);font-size:26px;
        filter:drop-shadow(0 0 10px rgba(255,209,102,0.85));animation:as-flagwave 2.2s ease-in-out infinite;transform-origin:bottom center;}
      @keyframes as-flagwave{0%,100%{transform:translate(-50%,-100%) rotate(0deg);}50%{transform:translate(-50%,-100%) rotate(6deg);}}
      .as-eyebrow{font-family:var(--font-mono,monospace);font-size:11px;letter-spacing:0.22em;
        color:rgba(255,209,102,0.75);text-transform:uppercase;margin-bottom:6px;}
      .as-title{font-family:var(--font-display,inherit);font-size:30px;font-weight:800;
        color:#ffe9b0;letter-spacing:0.01em;margin:0 0 4px;text-shadow:0 0 30px rgba(255,209,102,0.45);
        animation:as-titlepulse 2.6s ease-in-out infinite;}
      @keyframes as-titlepulse{0%,100%{text-shadow:0 0 24px rgba(255,209,102,0.35);}50%{text-shadow:0 0 40px rgba(255,209,102,0.65);}}
      .as-missionname{font-family:var(--font-body,inherit);font-size:14px;color:#cfe0ff;opacity:0.85;margin-bottom:22px;}
      .as-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;}
      .as-stat{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 6px;}
      .as-stat-val{font-family:var(--font-display,inherit);font-size:22px;font-weight:800;color:#4aa8ff;}
      .as-stat-label{font-family:var(--font-mono,monospace);font-size:8.5px;letter-spacing:0.1em;
        color:rgba(200,215,240,0.55);text-transform:uppercase;margin-top:3px;}
      .as-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
      .as-btn{padding:13px 22px;border-radius:10px;font-family:var(--font-body,inherit);font-size:14px;
        font-weight:600;cursor:pointer;border:none;transition:.15s;}
      .as-btn-primary{background:#ffd166;color:#1a1204;}
      .as-btn-primary:hover{background:#ffdb85;}
      .as-btn-secondary{background:transparent;color:#cfe0ff;border:1px solid rgba(120,150,200,0.3);}
      .as-btn-secondary:hover{border-color:rgba(150,180,230,0.6);color:#fff;}
      .as-mute{position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;
        color:rgba(200,215,240,0.5);font-size:16px;padding:4px;z-index:3;}
      .as-mute:hover{color:#fff;}
    `;
    document.head.appendChild(css);
  }

  /* ---- Confetti (canvas, self-contained physics) ---- */
  function runConfetti(canvas){
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    function resize(){
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resize();
    window.addEventListener('resize', resize);

    var COLORS = ['#ffd166','#4aa8ff','#3ddc84','#ff9f6b','#cfe0ff','#ff5c6c'];
    var pieces = [];
    var W = function(){ return window.innerWidth; };
    var H = function(){ return window.innerHeight; };

    function spawnBurst(cx, cy, count){
      for(var i=0;i<count;i++){
        var angle = (Math.random()*Math.PI) - Math.PI; /* upward-biased spray */
        var speed = 4 + Math.random()*9;
        pieces.push({
          x: cx, y: cy,
          vx: Math.cos(angle)*speed*(Math.random()<0.5?1:-1)*0.6 + (Math.random()-0.5)*6,
          vy: Math.sin(angle)*speed - 6 - Math.random()*4,
          size: 5 + Math.random()*6,
          color: COLORS[(Math.random()*COLORS.length)|0],
          rot: Math.random()*Math.PI*2,
          vrot: (Math.random()-0.5)*0.3,
          shape: Math.random()<0.5?'rect':'circle',
          life: 0,
          maxLife: 220 + Math.random()*100
        });
      }
    }

    /* Initial big burst from center, then a couple of quick follow-ups
       from the sides for a fuller "fireworks" opening moment. */
    spawnBurst(W()/2, H()*0.4, 140);
    setTimeout(function(){ spawnBurst(W()*0.2, H()*0.35, 60); }, 300);
    setTimeout(function(){ spawnBurst(W()*0.8, H()*0.35, 60); }, 500);

    /* Then keep the celebration genuinely alive -- a smaller burst every
       ~2.2s from a random spot along the top, for as long as the summit
       card stays open. This is what makes it feel like a real sustained
       celebration rather than a few seconds of confetti in front of an
       otherwise-static "done" screen. Cleared by stop() the moment the
       operator picks any of the close buttons. */
    var sustainInterval = setInterval(function(){
      var x = W()*0.15 + Math.random()*W()*0.7;
      spawnBurst(x, H()*0.3, 34);
    }, 2200);

    var running = true;
    var gravity = 0.16;
    function tick(){
      if(!running) return;
      ctx.clearRect(0,0,W(),H());
      for(var i=pieces.length-1;i>=0;i--){
        var p = pieces[i];
        p.vy += gravity;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.life++;
        var fade = Math.max(0, 1 - (p.life / p.maxLife));
        if(p.life > p.maxLife || p.y > H()+40){ pieces.splice(i,1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        if(p.shape==='rect'){ ctx.fillRect(-p.size/2, -p.size/3, p.size, p.size*0.6); }
        else { ctx.beginPath(); ctx.arc(0,0,p.size/2,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
      }
      if(pieces.length>0) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    return function stop(){
      running = false;
      clearInterval(sustainInterval);
      window.removeEventListener('resize', resize);
    };
  }

  /* ---- Fanfare (Web Audio API, synthesized — no audio file needed) ---- */
  function playFanfare(){
    try{
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      var ctx = new Ctx();
      var now = ctx.currentTime;
      var notes = [523.25, 659.25, 783.99, 1046.50]; /* C5 E5 G5 C6 — a simple rising triad + octave */
      notes.forEach(function(freq, i){
        var t = now + i*0.11;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t+0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t+0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t+0.55);
      });
      /* final sustained bell on top */
      var bellT = now + 0.42;
      var bosc = ctx.createOscillator();
      var bgain = ctx.createGain();
      bosc.type = 'sine';
      bosc.frequency.setValueAtTime(1046.50, bellT);
      bgain.gain.setValueAtTime(0, bellT);
      bgain.gain.linearRampToValueAtTime(0.22, bellT+0.03);
      bgain.gain.exponentialRampToValueAtTime(0.0001, bellT+1.4);
      bosc.connect(bgain).connect(ctx.destination);
      bosc.start(bellT);
      bosc.stop(bellT+1.5);
      setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 2200);
    }catch(e){ /* audio not available — silently skip, visuals still work */ }
  }

  /* ---- Count-up animation for stat numbers ---- */
  function countUp(el, target, duration){
    var start = performance.now();
    function frame(now){
      var p = Math.min(1, (now-start)/duration);
      var eased = 1 - Math.pow(1-p, 3);
      el.textContent = Math.round(target * eased);
      if(p<1) requestAnimationFrame(frame);
      else el.textContent = target;
    }
    requestAnimationFrame(frame);
  }

  /* ---- Lightweight domain-conquered toast ----
     A domain can only reach 100% at the exact moment its last
     remaining in-progress mission completes, so this is meant to be
     called alongside show() (the full mission celebration), not
     instead of it -- a small corner notification, not a second
     full-screen takeover. Stacks if more than one domain completes
     from the same action. Auto-dismisses; no buttons, no blocking. */
  var domainToastCount = 0;
  function showDomainToast(opts){
    opts = opts || {};
    injectStyles();
    if(!document.getElementById('as-domain-toast-css')){
      var css = document.createElement('style');
      css.id = 'as-domain-toast-css';
      css.textContent = `
        .as-dtoast{position:fixed;right:20px;z-index:99998;display:flex;align-items:center;gap:12px;
          background:rgba(10,15,26,0.94);border:1px solid rgba(255,255,255,0.14);border-radius:12px;
          padding:14px 18px;box-shadow:0 12px 40px rgba(0,0,0,0.5);
          transform:translateX(120%);transition:transform .45s cubic-bezier(.2,.9,.25,1);max-width:300px;}
        .as-dtoast.show{transform:translateX(0);}
        .as-dtoast-icon{font-size:22px;flex-shrink:0;filter:drop-shadow(0 0 8px rgba(255,209,102,0.6));}
        .as-dtoast-eyebrow{font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:0.14em;
          text-transform:uppercase;color:rgba(255,209,102,0.75);}
        .as-dtoast-name{font-family:var(--font-body,inherit);font-size:14px;font-weight:700;margin-top:2px;}
      `;
      document.head.appendChild(css);
    }

    var toast = document.createElement('div');
    toast.className = 'as-dtoast';
    toast.style.bottom = (24 + domainToastCount * 78) + 'px';
    toast.innerHTML =
      '<div class="as-dtoast-icon">&#127937;</div>' +
      '<div><div class="as-dtoast-eyebrow">Domain Conquered</div>' +
      '<div class="as-dtoast-name" style="color:'+(opts.color||'#ffd166')+';">'+esc(opts.domainName||'')+'</div></div>';
    document.body.appendChild(toast);
    domainToastCount++;

    function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    requestAnimationFrame(function(){ toast.classList.add('show'); });
    setTimeout(function(){
      toast.classList.remove('show');
      setTimeout(function(){ toast.remove(); domainToastCount = Math.max(0, domainToastCount-1); }, 500);
    }, 5000);

    if(window.AetherVoice) window.AetherVoice.congratulateDomain(opts.domainName || '');
  }

  function show(opts){
    opts = opts || {};
    injectStyles();

    var overlay = document.createElement('div');
    overlay.className = 'as-overlay';

    var canvas = document.createElement('canvas');
    canvas.className = 'as-canvas';
    overlay.appendChild(canvas);

    var muteBtn = document.createElement('button');
    muteBtn.className = 'as-mute';
    muteBtn.innerHTML = '&#128266;';
    muteBtn.title = 'Mute fanfare';
    var muted = false;
    muteBtn.onclick = function(){
      muted = !muted;
      muteBtn.innerHTML = muted ? '&#128263;' : '&#128266;';
    };
    overlay.appendChild(muteBtn);

    var card = document.createElement('div');
    card.className = 'as-card';

    var mountainHtml = '';
    if(opts.mountainOpts && window.MissionMountain){
      try{
        var full = Object.assign({}, opts.mountainOpts, {pct:100, variant:'hero'});
        var r = window.MissionMountain.render(full);
        mountainHtml = '<div class="as-mountain">'+r.svg+'<div class="as-flag">&#127937;</div></div>';
      }catch(e){ mountainHtml = '<div class="as-mountain"><div class="as-flag" style="position:static;font-size:48px;">&#127937;</div></div>'; }
    } else {
      mountainHtml = '<div class="as-mountain"><div class="as-flag" style="position:static;font-size:48px;">&#127937;</div></div>';
    }

    card.innerHTML =
      mountainHtml +
      '<div class="as-eyebrow">Summit Reached</div>' +
      '<div class="as-title">Mission Complete</div>' +
      '<div class="as-missionname">'+ (opts.missionName ? esc(opts.missionName) : '') +'</div>' +
      '<div class="as-stats">' +
        stat('as-days', opts.daysClimbing, 'Days Climbing') +
        stat('as-steps', opts.totalSteps, 'Steps Verified') +
        stat('as-evid', opts.evidenceCount, 'Evidence Logged') +
        stat('as-conf', opts.confidencePct, 'Confidence', '%') +
      '</div>' +
      '<div class="as-btns">' +
        '<button class="as-btn as-btn-primary" id="asBtnNext">Next Mission, Sir?</button>' +
        '<button class="as-btn as-btn-secondary" id="asBtnArchive">View Summit Archive</button>' +
        '<button class="as-btn as-btn-secondary" id="asBtnContinue">Return to Dashboard</button>' +
      '</div>';

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    if(window.AetherVoice) window.AetherVoice.congratulateMission(opts.missionName || '');

    function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function stat(id, val, label, suffix){
      return '<div class="as-stat"><div class="as-stat-val" id="'+id+'">0'+(suffix||'')+'</div>'+
             '<div class="as-stat-label">'+label+'</div></div>';
    }

    requestAnimationFrame(function(){
      overlay.classList.add('show');
      var stopConfetti = runConfetti(canvas);
      if(!muted) playFanfare();
      if(window.AetherMusic){
        setTimeout(function(){ window.AetherMusic.playCelebrationLoop(); }, 1800);
      }
      countUp(document.getElementById('as-days'), opts.daysClimbing||0, 1200);
      countUp(document.getElementById('as-steps'), opts.totalSteps||0, 1200);
      countUp(document.getElementById('as-evid'), opts.evidenceCount||0, 1200);
      var confEl = document.getElementById('as-conf');
      var confSuffix = '%';
      (function(){
        var start = performance.now(), target = opts.confidencePct||0, dur=1200;
        function frame(now){
          var p = Math.min(1,(now-start)/dur);
          var eased = 1-Math.pow(1-p,3);
          confEl.textContent = Math.round(target*eased) + confSuffix;
          if(p<1) requestAnimationFrame(frame); else confEl.textContent = target + confSuffix;
        }
        requestAnimationFrame(frame);
      })();

      overlay._stopConfetti = stopConfetti;
    });

    function close(after){
      overlay.classList.remove('show');
      if(window.AetherMusic) window.AetherMusic.stopLoop();
      setTimeout(function(){
        if(overlay._stopConfetti) overlay._stopConfetti();
        overlay.remove();
        if(after) after();
      }, 400);
    }

    document.getElementById('asBtnNext').onclick = function(){
      close(opts.onNextMission || function(){ window.location.href = 'missions.html'; });
    };
    document.getElementById('asBtnArchive').onclick = function(){ close(opts.onArchive); };
    document.getElementById('asBtnContinue').onclick = function(){ close(opts.onContinue); };
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(opts.onContinue); });
  }

  window.AetherCelebration = { show: show, showDomainToast: showDomainToast };
})();
