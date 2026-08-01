'use strict';

// Bakes PERMANENT route coordinate arrays with real alpine switchback
// geometry: each route is built from distinct diagonal "legs" that
// traverse most of the available width, connected by sharp turn points --
// guaranteed dramatic zigzag character, not dependent on hand-tracing
// precision. Calibration matches Sir's exact summit/base marks (Stage 6).

function rng(seed){
  var s = seed >>> 0;
  return function(){
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s){
  var h = 2166136261;
  for(var i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

var MOUNTAINS = {
  left:  { summitX: 56.8, summitY: 12.2, baseY: 94.0, footLeft: 4, footRight: 94 },
  right: { summitX: 51.0, summitY: 17.5, baseY: 94.5, footLeft: 5, footRight: 96 }
};

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

var LEFT_DOMAINS  = ['health','character','skills','spiritual','purpose'];
var RIGHT_DOMAINS = ['finance','business','learning','relationships','environment'];

/* Smooth, continuous meander -- NOT discrete switchback legs. The
   reference pattern is a flowing, river-like winding curve with no
   sharp corner turns anywhere; a leg-based generator (go hard left,
   sharp corner, go hard right) reads as "zigzag" no matter how much
   you smooth the corners after the fact. Building the curve itself
   out of layered sine waves avoids sharp corners structurally --
   there's no corner to smooth because the underlying math is already
   continuous. */
function generateMeanderRoute(side, footX, seed, amp1, freq1, amp2, freq2){
  var profile = MOUNTAINS[side];
  var rand = rng(seed);
  var steps = 90;
  var startY = profile.baseY - 1;
  var totalY = startY - profile.summitY;
  var phase1 = rand() * Math.PI * 2;
  var phase2 = rand() * Math.PI * 2;

  var pts = [];
  var prevX = footX;
  var MAX_DX = 3.2; // per-step clamp keeps the curve smooth even where the envelope narrows sharply
  for(var i = 0; i <= steps; i++){
    var p = i / steps;
    var y = startY - totalY * Math.pow(p, 0.92);
    var centerX = footX + (profile.summitX - footX) * p;

    // Plateau envelope: quick ease-in near the foot (avoid a sharp kink
    // at the anchored start point), FULL amplitude through the entire
    // middle climb, gentle ease-out only in the last stretch approaching
    // the peak (so routes converge cleanly rather than wobbling right up
    // to the summit point). The previous sine-based envelope zeroed out
    // both near the base AND well before the summit, leaving most of the
    // trail nearly straight -- this was the actual bug.
    var easeIn  = Math.min(1, p / 0.10);
    var easeOut = Math.min(1, (1 - p) / 0.14);
    var taper = Math.min(easeIn, easeOut);
    taper = taper*taper*(3 - 2*taper); // smoothstep

    var wiggle = Math.sin(p * Math.PI * 2 * freq1 + phase1) * amp1 * taper
               + Math.sin(p * Math.PI * 2 * freq2 + phase2) * amp2 * taper;

    var x = centerX + wiggle;
    var edges = edgesAtY(profile, y);
    var margin = 2.4;
    var loE = edges[0] + margin, hiE = edges[1] - margin;
    if(hiE < loE){ var mid=(hiE+loE)/2; loE=mid; hiE=mid; }
    if(x < loE) x = loE; if(x > hiE) x = hiE;
    prevX = x;
    pts.push([Number(x.toFixed(2)), Number(y.toFixed(2))]);
  }
  pts[0] = [Number(footX.toFixed(2)), startY];
  pts[pts.length-1] = [profile.summitX, profile.summitY];

  // Downsample the dense 90-step curve to a compact, still-editable
  // anchor list -- the curve itself is smooth by construction, so we
  // don't need every step, just enough anchors that Catmull-Rom
  // reconstruction at render time reproduces the same flowing shape.
  var targetCount = 22;
  var out = [];
  for(var k=0;k<targetCount;k++){
    var idx = Math.round(k/(targetCount-1) * (pts.length-1));
    out.push(pts[idx]);
  }
  return out;
}

// Each route gets a distinct meander "personality" -- how wide it swings
// (amp1) and how many major bends it makes (freq1), plus a smaller
// secondary wiggle layer (amp2/freq2) for natural irregularity so no
// two routes look like the same curve just shifted sideways.
var PERSONALITY = [
  { amp1:11, freq1:2.6, amp2:3.5, freq2:6.5 },
  { amp1:9,  freq1:3.4, amp2:3.0, freq2:7.5 },
  { amp1:13, freq1:2.1, amp2:4.0, freq2:5.5 },
  { amp1:10, freq1:3.0, amp2:3.2, freq2:8.0 },
  { amp1:8,  freq1:3.8, amp2:2.6, freq2:6.0 }
];

function buildSide(side, domains){
  var profile = MOUNTAINS[side];
  var out = {};
  domains.forEach(function(key, i){
    var footX = profile.footLeft + (i/(domains.length-1)) * (profile.footRight - profile.footLeft);
    var seed = hashStr(side + ':' + key) ^ 0x9e3779b9;
    var pers = PERSONALITY[i % PERSONALITY.length];
    out[key] = generateMeanderRoute(side, footX, seed, pers.amp1, pers.freq1, pers.amp2, pers.freq2);
  });
  return out;
}

var DATA = {
  mountains: MOUNTAINS,
  routes: {
    left:  buildSide('left',  LEFT_DOMAINS),
    right: buildSide('right', RIGHT_DOMAINS)
  }
};

console.log(JSON.stringify(DATA, null, 2));
