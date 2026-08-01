/* ============================================================
   GREAT MOUNTAIN v3 — TWIN PEAKS OF LIFE ADVANCEMENT
   ------------------------------------------------------------
   Two mountains. Five routes each. Two summits. One life.

   LEFT  MOUNTAIN — Internal Life:  Health, Character, Skills,
                     Spiritual Life, Purpose
   RIGHT MOUNTAIN — External Life:  Finance, Business, Learning,
                     Relationships, Environment

   Public API (unchanged call site, extended payload):
     GreatMountain.render(domains) -> {
       left:  { svg, labelsHtml, meta },
       right: { svg, labelsHtml, meta }
     }
     GreatMountain.attachInteractivity(rootEl)   // wire hover/click/keyboard
       -- call once per mountain container after injecting svg+labels.

   ARCHITECTURE, per the Epic Mountain Directive:
     Background Image (real photo, set in CSS)
       -> SVG Overlay (THIS FILE — transparent tracing paper only)
       -> Routes / Camps / Labels / Progress / Interaction
   The SVG never draws rock, silhouette, or procedural terrain.

   ROUTE PERMANENCE, per the Twin Peaks Directive:
     Route coordinates are generated ONCE from a fixed seed per
     domain id and memoized in ROUTE_CACHE. They are never re-
     randomized on re-render, hover, or interaction — the same
     domain id always produces the exact same path, every session.
     This is the practical equivalent of "stored" coordinates
     without hand-maintaining hundreds of literal point arrays;
     if you later want to hand-tune a specific route, call
     GreatMountain.exportRoute(domainId) to get its literal point
     array and hardcode it into ROUTE_OVERRIDES below.
   ============================================================ */
(function(global){
  'use strict';

  /* ============================================================
     0. DOMAIN -> MOUNTAIN + ROUTE-KEY RESOLUTION
     ============================================================ */
  var DOMAIN_MAP = [
    { kw:'health',       side:'left',  key:'health' },
    { kw:'character',    side:'left',  key:'character' },
    { kw:'skill',        side:'left',  key:'skills' },
    { kw:'spirit',       side:'left',  key:'spiritual' },
    { kw:'purpose',      side:'left',  key:'purpose' },
    { kw:'financ',       side:'right', key:'finance' },
    { kw:'business',     side:'right', key:'business' },
    { kw:'learn',        side:'right', key:'learning' },
    { kw:'relationship', side:'right', key:'relationships' },
    { kw:'environment',  side:'right', key:'environment' }
  ];

  function resolveDomain(name){
    var n = (name || '').toLowerCase();
    for(var i=0;i<DOMAIN_MAP.length;i++){
      if(n.indexOf(DOMAIN_MAP[i].kw) !== -1) return DOMAIN_MAP[i];
    }
    return null; // unmatched -> resolved by positional fallback in splitDomains()
  }

  function splitDomains(domains){
    var left = [], right = [], unmatched = [];
    domains.forEach(function(d){
      var m = resolveDomain(d.name);
      if(m && m.side === 'left') left.push(d);
      else if(m && m.side === 'right') right.push(d);
      else unmatched.push(d);
    });
    // Fallback: if keyword matching didn't produce a clean 5/5 split
    // (custom domain naming), distribute remaining domains in original
    // order so every domain is still shown and each side stays balanced.
    unmatched.forEach(function(d){
      if(left.length <= right.length) left.push(d); else right.push(d);
    });
    return { left: left.slice(0,5), right: right.slice(0,5) };
  }

  /* ============================================================
     1. MOUNTAIN PROFILES — two distinct climbing personalities.
        summitX/summitY/baseY/footLeft/footRight are read from
        route-data.js (calibrated against the real photos' actual
        peak/base positions). If that file isn't loaded for some
        reason, these inline values are the fallback.
     ============================================================ */
  var _RD = global.AETHER_ROUTE_DATA; // populated by route-data.js, if loaded first

  var MOUNTAINS = {
    left: {
      title: 'Internal Life',
      subtitle: 'Personal Mastery',
      summitName: 'Kailash Ridge',
      summitElevation: 6638,
      baseElevation: 4200,
      profile: (_RD && _RD.mountains && _RD.mountains.left) || { summitX: 44.6, summitY: 13, baseY: 94, footLeft: 4, footRight: 94 },
      accentGlow: '#ffd166'
    },
    right: {
      title: 'External Life',
      subtitle: 'Built Impact',
      summitName: 'Cordillera Traverse',
      summitElevation: 7285,
      baseElevation: 3600,
      profile: (_RD && _RD.mountains && _RD.mountains.right) || { summitX: 49.8, summitY: 11, baseY: 94.5, footLeft: 5, footRight: 96 },
      accentGlow: '#ffb88c'
    }
  };

  var CAMP_LADDER = [
    { key:'base',  label:'Base Camp', frac:0.0 },
    { key:'c1',    label:'Camp I',    frac:0.20 },
    { key:'c2',    label:'Camp II',   frac:0.40 },
    { key:'c3',    label:'Camp III',  frac:0.60 },
    { key:'high',  label:'High Camp', frac:0.80 },
    { key:'summit',label:'Summit',    frac:1.0 }
  ];

  /* Hand-tuned overrides, keyed by domain id. Populate via
     exportRoute() if a specific route ever needs manual refinement
     to match real terrain features in the final photo. Empty by
     default -- deterministic generation is used until then. */
  var ROUTE_OVERRIDES = {};

  /* ============================================================
     2. RNG + geometry helpers
     ============================================================ */
  function rng(seed){
    var s = seed >>> 0;
    return function(){
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function hashStr(s){
    var h = 2166136261;
    for(var i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function ridgeY(profile, x){
    if(x <= profile.summitX){
      var f = (x - profile.footLeft) / (profile.summitX - profile.footLeft);
      f = Math.max(0, Math.min(1, f));
      return profile.baseY + (profile.summitY - profile.baseY) * Math.pow(f, 1.05);
    } else {
      var g = (x - profile.summitX) / (profile.footRight - profile.summitX);
      g = Math.max(0, Math.min(1, g));
      return profile.summitY + (profile.baseY - profile.summitY) * Math.pow(g, 0.95);
    }
  }
  function edgesAtY(profile, y){
    var left = profile.summitX, right = profile.summitX;
    for(var x = profile.footLeft; x <= profile.summitX; x += 0.5){ if(ridgeY(profile,x) <= y){ left = x; break; } }
    for(var x2 = profile.footRight; x2 >= profile.summitX; x2 -= 0.5){ if(ridgeY(profile,x2) <= y){ right = x2; break; } }
    return [left, right];
  }

  /* ============================================================
     3. ROUTE RESOLUTION — reads permanent data, never regenerates.
        route-data.js stores ~14 hand-editable anchor points per
        route. Catmull-Rom densification expands those into a
        smooth 60-step path at load time (once, memoized) so
        progress still renders at fine granularity even though the
        underlying data stays compact and easy to hand-tune.
     ============================================================ */
  var ROUTE_CACHE = {};

  function catmullRom(p0,p1,p2,p3,t){
    var t2 = t*t, t3 = t2*t;
    return 0.5*((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
  }
  function densify(anchors, targetSteps){
    var n = anchors.length;
    if(n < 2) return anchors.slice();
    var out = [];
    for(var i=0;i<=targetSteps;i++){
      var u = i/targetSteps * (n-1);
      var idx = Math.min(Math.floor(u), n-2);
      var t = u - idx;
      var p0 = anchors[Math.max(0,idx-1)];
      var p1 = anchors[idx];
      var p2 = anchors[Math.min(n-1,idx+1)];
      var p3 = anchors[Math.min(n-1,idx+2)];
      var x = catmullRom(p0[0],p1[0],p2[0],p3[0],t);
      var y = catmullRom(p0[1],p1[1],p2[1],p3[1],t);
      out.push([Number(x.toFixed(2)), Number(y.toFixed(2))]);
    }
    out[0] = anchors[0].slice();
    out[out.length-1] = anchors[n-1].slice();
    return out;
  }

  // Fallback generator, used ONLY if a domain has no entry in route-data.js
  // (e.g. a brand-new custom domain that hasn't been baked into data yet).
  function generateFallbackRoute(side, footX, seed){
    var profile = MOUNTAINS[side].profile;
    var rand = rng(seed);
    var steps = 60, zig = 3 + Math.floor(rand()*2), baseAmp = 6 + rand()*4;
    var pts = [];
    var prevX = footX;
    var MAX_DX = 5.5;
    for(var i = 0; i <= steps; i++){
      var p = i / steps;
      var cx = footX + (profile.summitX - footX) * p;
      var cy = (profile.baseY - 1) + (profile.summitY - (profile.baseY - 1)) * p;
      var ease = Math.sin(Math.PI * p);
      var phase = p * zig * Math.PI + rand() * 0.6;
      var x = cx + Math.sin(phase) * baseAmp * ease;
      var edges = edgesAtY(profile, cy);
      var loM = edges[0] + 2.6, hiM = edges[1] - 2.6;
      if(x < loM) x = loM; if(x > hiM) x = hiM;
      if(x - prevX >  MAX_DX) x = prevX + MAX_DX;
      if(x - prevX < -MAX_DX) x = prevX - MAX_DX;
      if(x < loM) x = loM; if(x > hiM) x = hiM;
      prevX = x;
      pts.push([Number(x.toFixed(2)), Number(cy.toFixed(2))]);
    }
    pts[pts.length-1] = [profile.summitX, profile.summitY];
    pts[0] = [footX, profile.baseY - 1];
    return pts;
  }

  function getRoute(side, domainKey, domainId, footX){
    if(ROUTE_OVERRIDES[domainId]) return ROUTE_OVERRIDES[domainId];
    var cacheKey = side + ':' + (domainKey || domainId);
    if(ROUTE_CACHE[cacheKey]) return ROUTE_CACHE[cacheKey];

    var anchors = _RD && _RD.routes && _RD.routes[side] && domainKey ? _RD.routes[side][domainKey] : null;
    var pts;
    if(anchors && anchors.length >= 2){
      pts = densify(anchors, 60);
    } else {
      // no permanent data for this domain -- deterministic fallback so it's
      // at least stable across renders, but flag it for baking into data.
      var seed = hashStr(cacheKey) ^ 0x9e3779b9;
      pts = generateFallbackRoute(side, footX, seed);
    }
    ROUTE_CACHE[cacheKey] = pts;
    return pts;
  }

  function pathFrom(pts, count){
    if(count < 1) return '';
    var seg = pts.slice(0, count + 1);
    if(seg.length < 2) return '';
    var d = 'M ' + seg[0][0].toFixed(1) + ' ' + seg[0][1].toFixed(1);
    for(var i = 1; i < seg.length - 1; i++){
      var mx = (seg[i][0] + seg[i+1][0]) / 2, my = (seg[i][1] + seg[i+1][1]) / 2;
      d += ' Q ' + seg[i][0].toFixed(1) + ' ' + seg[i][1].toFixed(1) + ', ' + mx.toFixed(1) + ' ' + my.toFixed(1);
    }
    d += ' L ' + seg[seg.length-1][0].toFixed(1) + ' ' + seg[seg.length-1][1].toFixed(1);
    return d;
  }
  function fullPath(pts){ return pathFrom(pts, pts.length-1); }

  /* ============================================================
     4. CAMP MARKERS — minimalist expedition style (diamond + tick)
     ============================================================ */
  function campMarker(cx, cy, color, campKey, done){
    var s = '';
    var r = campKey === 'summit' ? 0 : 0.62;
    if(campKey === 'summit') return ''; // summit gets its own beacon, not a camp dot
    var op = done ? 0.95 : 0.35;
    s += '<g class="gm-camp" data-camp="'+campKey+'">';
    s += '<path d="M '+cx.toFixed(2)+' '+(cy-r).toFixed(2)+' L '+(cx+r).toFixed(2)+' '+cy.toFixed(2)+' L '+cx.toFixed(2)+' '+(cy+r).toFixed(2)+' L '+(cx-r).toFixed(2)+' '+cy.toFixed(2)+' Z" fill="'+(done?color:'rgba(160,175,200,0.5)')+'" stroke="rgba(6,9,15,0.85)" stroke-width="0.14" opacity="'+op+'"/>';
    if(done){ s += '<circle cx="'+cx.toFixed(2)+'" cy="'+cy.toFixed(2)+'" r="0.18" fill="rgba(6,9,15,0.85)"/>'; }
    s += '</g>';
    return s;
  }

  /* ============================================================
     5. SUMMIT BEACON
     ============================================================ */
  function summitBeacon(profile, glowColor, anyConquered){
    var x = profile.summitX, y = profile.summitY;
    var s = '';
    s += '<ellipse cx="'+x+'" cy="'+(y+1.4)+'" rx="8" ry="2.2" fill="rgba(255,225,180,0.10)" filter="url(#gmBigBlur)"/>';
    if(anyConquered){
      // A domain has been fully summited -- the shared peak beacon breathes
      // noticeably brighter and wider, marking real conquest, not just ambiance.
      s += '<circle cx="'+x+'" cy="'+y+'" r="5" fill="'+glowColor+'" filter="url(#gmBigBlur)">'+
             '<animate attributeName="opacity" values="0.22;0.5;0.22" dur="2.4s" repeatCount="indefinite"/>'+
             '<animate attributeName="r" values="4.5;7;4.5" dur="2.4s" repeatCount="indefinite"/>'+
           '</circle>';
      s += '<circle cx="'+x+'" cy="'+y+'" r="2.3" fill="'+glowColor+'" filter="url(#gmGlow)">'+
             '<animate attributeName="opacity" values="0.35;0.75;0.35" dur="2.4s" repeatCount="indefinite"/>'+
           '</circle>';
    } else {
      // Ambient, subtle idle pulse — always alive, never distracting until earned.
      s += '<circle cx="'+x+'" cy="'+y+'" r="5" fill="'+glowColor+'" filter="url(#gmBigBlur)">'+
             '<animate attributeName="opacity" values="0.16;0.26;0.16" dur="3.4s" repeatCount="indefinite"/>'+
           '</circle>';
      s += '<circle cx="'+x+'" cy="'+y+'" r="2.3" fill="'+glowColor+'" opacity="0.4" filter="url(#gmGlow)"/>';
    }
    s += '<circle cx="'+x+'" cy="'+y+'" r="1.1" fill="#fff3d6" stroke="rgba(30,20,5,0.5)" stroke-width="0.18"/>';
    // tiny summit flag
    s += '<line x1="'+x+'" y1="'+(y-1.1)+'" x2="'+x+'" y2="'+(y-2.3)+'" stroke="#e8ecf5" stroke-width="0.1"/>';
    s += '<path d="M '+x+' '+(y-2.3)+' l 0.9 0.26 l -0.9 0.26 Z" fill="'+glowColor+'"/>';
    return s;
  }

  /* ============================================================
     6. RENDER ONE MOUNTAIN
     ============================================================ */
  function renderMountain(side, domains, weatherKey){
    var m = MOUNTAINS[side];
    var profile = m.profile;
    var svg = '<svg class="gm-mountain-svg" data-side="'+side+'" viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;position:absolute;inset:0;">';
    svg += '<defs>';
    svg += '<filter id="gmGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="0.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    svg += '<filter id="gmSoftBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>';
    svg += '<filter id="gmBigBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>';
    svg += '</defs>';

    // faint depth haze, purely atmospheric
    svg += '<rect x="0" y="70" width="100" height="26" fill="rgba(150,175,225,0.05)" filter="url(#gmSoftBlur)"/>';
    // real weather, driven by this mountain's actual domain trends
    svg += weatherLayer(weatherKey);

    var labelsHtml = '';
    var railHtml = '';
    var meta = { side: side, title: m.title, subtitle: m.subtitle, summitName: m.summitName, routes: [] };

    var anyConquered = false;

    domains.forEach(function(d, i){
      var footX = domains.length > 1
        ? profile.footLeft + (i/(domains.length-1)) * (profile.footRight - profile.footLeft)
        : (profile.footLeft + profile.footRight)/2;
      var domainId = d.id || d.name || ('domain'+i);
      var domainMatch = resolveDomain(d.name);
      var domainKey = domainMatch ? domainMatch.key : null;
      var pts = getRoute(side, domainKey, domainId, footX);
      var steps = pts.length - 1;
      var t = Math.max(0, Math.min((d.pct || d.progress || 0)/100, 1));
      var drawCount = Math.round(steps * t);
      var color = d.color || m.accentGlow;
      var conquered = t >= 1;
      if(conquered) anyConquered = true;

      // full route, faint (20% baseline) — the "always visible, never hero" guide
      var full = fullPath(pts);
      svg += '<path class="gm-route-full" data-domain-id="'+esc(domainId)+'" data-side="'+side+'" d="'+full+'" fill="none" stroke="'+color+'" stroke-width="0.5" stroke-dasharray="0.9 1.7" stroke-linecap="round" opacity="0.20"/>';
      // completed portion
      if(drawCount >= 1){
        var earned = pathFrom(pts, drawCount);
        if(conquered){
          // CONQUERED — pulsating glow: a soft blurred halo breathing behind
          // a bright animated line, marking this domain as fully summited.
          svg += '<path d="'+earned+'" fill="none" stroke="'+color+'" stroke-width="1.4" stroke-linecap="round" filter="url(#gmGlow)" opacity="0.35">'+
                   '<animate attributeName="opacity" values="0.22;0.55;0.22" dur="2.6s" repeatCount="indefinite"/>'+
                 '</path>';
          svg += '<path class="gm-route-done gm-route-conquered" data-domain-id="'+esc(domainId)+'" data-side="'+side+'" d="'+earned+'" fill="none" stroke="'+color+'" stroke-width="0.48" stroke-dasharray="0.9 1.7" stroke-linecap="round" opacity="0.8">'+
                   '<animate attributeName="opacity" values="0.65;1;0.65" dur="2.6s" repeatCount="indefinite"/>'+
                 '</path>';
        } else {
          svg += '<path class="gm-route-done" data-domain-id="'+esc(domainId)+'" data-side="'+side+'" d="'+earned+'" fill="none" stroke="'+color+'" stroke-width="0.42" stroke-dasharray="0.9 1.7" stroke-linecap="round" opacity="0.55"/>';
        }
      }
      // wide invisible hit-path for hover/click/keyboard (large hit area, accessibility)
      svg += '<path class="gm-route-hit" data-domain-id="'+esc(domainId)+'" data-domain-name="'+esc(d.name||'')+'" data-side="'+side+'" d="'+full+'" fill="none" stroke="transparent" stroke-width="4" stroke-linecap="round" tabindex="0" role="button" aria-label="'+esc(d.name||'Route')+' — '+Math.round((d.pct||d.progress||0))+'% to summit"/>';

      // foot marker
      svg += '<circle cx="'+pts[0][0].toFixed(1)+'" cy="'+pts[0][1].toFixed(1)+'" r="0.85" fill="'+color+'" opacity="0.8" stroke="rgba(6,9,15,0.8)" stroke-width="0.22"/>';

      // camp ladder — minimalist markers, "done" once progress has passed that fraction
      CAMP_LADDER.forEach(function(camp){
        if(camp.key === 'summit') return; // handled by shared summit beacon
        var idx = Math.round(steps * camp.frac);
        var cp = pts[Math.min(idx, pts.length-1)];
        var done = t >= camp.frac - 0.001;
        svg += campMarker(cp[0], cp[1], color, camp.key, done);
      });

      // current position — the one genuinely bright node
      if(drawCount >= 1){
        var head = pts[Math.min(drawCount, pts.length-1)];
        if(conquered){
          svg += '<circle cx="'+head[0].toFixed(1)+'" cy="'+head[1].toFixed(1)+'" r="1.9" fill="'+color+'" opacity="0.3" filter="url(#gmGlow)">'+
                   '<animate attributeName="r" values="1.6;2.6;1.6" dur="2.6s" repeatCount="indefinite"/>'+
                   '<animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.6s" repeatCount="indefinite"/>'+
                 '</circle>';
        } else {
          svg += '<circle class="gm-head" cx="'+head[0].toFixed(1)+'" cy="'+head[1].toFixed(1)+'" r="1.5" fill="'+color+'" opacity="0.28" filter="url(#gmGlow)"/>';
        }
        svg += '<circle cx="'+head[0].toFixed(1)+'" cy="'+head[1].toFixed(1)+'" r="0.95" fill="'+color+'" stroke="rgba(6,9,15,0.9)" stroke-width="0.26"/>';
      }

      // leader-line label: short tick from the route foot up to the viewport edge,
      // then an HTML chip OUTSIDE the mountain (positioned by the rail below it).
      var elevation = Math.round(m.baseElevation + (m.summitElevation - m.baseElevation) * t);
      meta.routes.push({
        id: domainId, name: d.name || '', color: color, footX: pts[0][0],
        pct: Math.round((d.pct||d.progress||0)), elevation: elevation,
        camps: CAMP_LADDER.map(function(c){ return { label:c.label, done: t >= c.frac - 0.001 }; })
      });
      labelsHtml += '<div class="gm-label-tick" style="position:absolute;left:'+pts[0][0].toFixed(1)+'%;bottom:0;width:1px;height:8px;background:'+color+';opacity:0.55;"></div>';
      var railRow = (i % 2 === 0) ? 0 : 15;
      railHtml += '<a href="missions.html?domain='+encodeURIComponent(d.name||'')+'" class="peak-label-chip" data-domain-id="'+esc(domainId)+'" style="position:absolute;left:'+pts[0][0].toFixed(1)+'%;top:'+railRow+'px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;text-decoration:none;cursor:pointer;">'+
        '<span style="width:1px;height:6px;background:'+color+';opacity:0.65;"></span>'+
        '<span style="font-family:var(--font-mono,monospace);font-size:8px;letter-spacing:0.02em;color:'+color+';white-space:nowrap;text-shadow:0 1px 3px #000;">'+esc((d.name||'').split(' & ')[0])+'</span>'+
        '</a>';
    });

    svg += summitBeacon(profile, m.accentGlow, anyConquered);
    svg += '</svg>';

    var summitLabelHtml = '<div class="gm-summit-label" style="position:absolute;transform:translate(-50%,-40%);font-family:var(--font-mono,monospace);font-size:8.5px;letter-spacing:0.1em;color:'+m.accentGlow+';left:'+profile.summitX+'%;top:'+Math.max(profile.summitY,6)+'%;pointer-events:none;text-shadow:0 1px 5px #000;white-space:nowrap;">'+esc(m.summitName.toUpperCase())+' · '+m.summitElevation+'M</div>';

    return { svg: svg, labelsHtml: labelsHtml + summitLabelHtml, railHtml: railHtml, meta: meta };
  }

  /* ============================================================
     7. PUBLIC RENDER
     ============================================================ */
  /* ============================================================
     5b. WEATHER LAYER — real atmospheric variation, driven by each
         mountain's actual domain trend data (via deriveWeather-
         equivalent logic computed by the caller), not decorative
         randomness. 'clear' renders nothing extra -- the baseline
         look stays exactly as before for a mountain with no declining
         domains. Purely additive: never covers routes/camps/summit.
     ============================================================ */
  function weatherLayer(key){
    var s = '';
    if(key === 'storm'){
      s += '<rect x="0" y="0" width="100" height="55" fill="rgba(20,25,35,0.28)"/>';
      var rand = rng(9001);
      for(var i=0;i<14;i++){
        var rx = rand()*100, ry = 5 + rand()*40, len = 4 + rand()*5;
        s += '<line x1="'+rx.toFixed(1)+'" y1="'+ry.toFixed(1)+'" x2="'+(rx-2).toFixed(1)+'" y2="'+(ry+len).toFixed(1)+'" stroke="rgba(180,200,230,0.28)" stroke-width="0.25" stroke-linecap="round"/>';
      }
    } else if(key === 'fog'){
      s += '<rect x="0" y="55" width="100" height="30" fill="rgba(200,210,225,0.16)" filter="url(#gmBigBlur)"/>';
      s += '<rect x="0" y="68" width="100" height="20" fill="rgba(210,218,230,0.14)" filter="url(#gmSoftBlur)"/>';
    } else if(key === 'light_clouds'){
      var r2 = rng(4207);
      for(var j=0;j<3;j++){
        var cx = 15 + r2()*70, cy = 18 + r2()*22, rw = 10+r2()*10, rh=2.2+r2()*1.4;
        s += '<ellipse cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" rx="'+rw.toFixed(1)+'" ry="'+rh.toFixed(1)+'" fill="rgba(255,255,255,0.08)" filter="url(#gmSoftBlur)"/>';
      }
    }
    // 'clear' (or unrecognized) -> no extra layer, baseline look
    return s;
  }

  function render(domains, opts){
    domains = domains && domains.length ? domains : [];
    opts = opts || {};
    var split = splitDomains(domains);
    return {
      left:  renderMountain('left',  split.left,  opts.leftWeather),
      right: renderMountain('right', split.right, opts.rightWeather)
    };
  }

  function exportRoute(side, domainId){
    var key = side + ':' + domainId;
    return ROUTE_CACHE[key] ? JSON.stringify(ROUTE_CACHE[key]) : null;
  }

  /* ============================================================
     8. INTERACTIVITY — hover, tooltip, click, keyboard.
        Call once per mountain container AFTER injecting svg+labels.
        rootEl should be the .mountain-viewport (or equivalent)
        that contains both the injected <svg> and a tooltip target.
     ============================================================ */
  function attachInteractivity(rootEl, meta, opts){
    if(!rootEl || rootEl.__gmWired) return;
    rootEl.__gmWired = true;
    opts = opts || {};

    var tip = document.createElement('div');
    tip.className = 'gm-tooltip';
    tip.setAttribute('role', 'status');
    tip.style.cssText = 'position:absolute;pointer-events:none;z-index:40;display:none;'+
      'background:rgba(8,11,18,0.94);border:1px solid rgba(255,255,255,0.12);border-radius:6px;'+
      'padding:8px 10px;font-family:var(--font-mono,monospace);font-size:10px;color:#eef1f8;'+
      'max-width:200px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,0.5);';
    rootEl.appendChild(tip);

    function findRoute(id){
      var routes = (meta && meta.routes) || [];
      for(var i=0;i<routes.length;i++){ if(routes[i].id === id) return routes[i]; }
      return null;
    }

    function showTip(evt, route){
      if(!route) return;
      var doneCamps = route.camps.filter(function(c){return c.done;}).length;
      tip.innerHTML =
        '<div style="color:'+route.color+';font-size:11px;margin-bottom:4px;">'+esc(route.name)+'</div>'+
        '<div>Elevation: '+route.elevation.toLocaleString()+'m</div>'+
        '<div>Progress: '+route.pct+'%</div>'+
        '<div>Camps reached: '+doneCamps+' / '+route.camps.length+'</div>';
      tip.style.display = 'block';
      var rect = rootEl.getBoundingClientRect();
      var mx = (evt.clientX !== undefined ? evt.clientX : rect.left + rect.width/2) - rect.left;
      var my = (evt.clientY !== undefined ? evt.clientY : rect.top + rect.height/2) - rect.top;
      tip.style.left = Math.min(mx + 14, rect.width - 210) + 'px';
      tip.style.top  = Math.max(my - 10, 4) + 'px';
    }
    function hideTip(){ tip.style.display = 'none'; }

    function setHoverState(id, on){
      var els = rootEl.querySelectorAll('[data-domain-id="'+CSS.escape(id)+'"]');
      els.forEach(function(el){
        if(el.classList.contains('gm-route-full')){ el.style.opacity = on ? '0.55' : '0.20'; }
        if(el.classList.contains('gm-head')){ el.style.opacity = on ? '0.4' : '0.28'; }
      });
    }

    rootEl.addEventListener('mousemove', function(evt){
      var target = evt.target.closest && evt.target.closest('.gm-route-hit');
      if(!target){ hideTip(); return; }
      var id = target.getAttribute('data-domain-id');
      showTip(evt, findRoute(id));
    });
    rootEl.addEventListener('mouseover', function(evt){
      var target = evt.target.closest && evt.target.closest('.gm-route-hit');
      if(!target) return;
      setHoverState(target.getAttribute('data-domain-id'), true);
    });
    rootEl.addEventListener('mouseout', function(evt){
      var target = evt.target.closest && evt.target.closest('.gm-route-hit');
      if(!target) return;
      setHoverState(target.getAttribute('data-domain-id'), false);
      hideTip();
    });
    rootEl.addEventListener('click', function(evt){
      var target = evt.target.closest && evt.target.closest('.gm-route-hit');
      if(!target) return;
      var id = target.getAttribute('data-domain-id');
      var route = findRoute(id);
      rootEl.dispatchEvent(new CustomEvent('aether:route-select', { bubbles:true, detail: route }));
      if(typeof opts.onSelect === 'function') opts.onSelect(route);
    });
    // keyboard: Enter/Space activates the focused route same as click
    rootEl.addEventListener('keydown', function(evt){
      if(evt.key !== 'Enter' && evt.key !== ' ') return;
      var target = evt.target.closest && evt.target.closest('.gm-route-hit');
      if(!target) return;
      evt.preventDefault();
      var id = target.getAttribute('data-domain-id');
      var route = findRoute(id);
      showTip({clientX:undefined, clientY:undefined}, route);
      rootEl.dispatchEvent(new CustomEvent('aether:route-select', { bubbles:true, detail: route }));
      if(typeof opts.onSelect === 'function') opts.onSelect(route);
    });
  }

  global.GreatMountain = {
    render: render,
    attachInteractivity: attachInteractivity,
    exportRoute: exportRoute,
    MOUNTAINS: MOUNTAINS
  };

})(typeof window !== 'undefined' ? window : this);
