/* ============================================================
   AETHER — CITY LIGHTS FLICKER
   Animates the real city-light clusters in the earth artwork
   (earth.png on the splash page, earth-night.png on login) with
   a subtle, organic twinkle. Point positions were extracted
   directly from each image's actual bright pixels — not randomly
   scattered — so every flicker sits on a real light, never on
   open ocean or empty landmass.

   Usage: initEarthFlicker('earthFlickerCanvas', '.earth img', EARTH_LIGHT_POINTS, 'rgba(255,205,120,ALPHA)')
   Points are [x,y] fractions (0..1) of the image's own width/height,
   so this stays aligned at any responsive size.
   ============================================================ */
function initEarthFlicker(canvasId, imgSelector, points, colorTemplate, coverMode, intensity){
  var canvas = document.getElementById(canvasId);
  var img = document.querySelector(imgSelector);
  if(!canvas || !img) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  var cfg = Object.assign({
    minOpacity: 0.32,   /* base floor before the sine wave/jitter are applied */
    ampMain: 0.55,       /* how far the slow sine wave swings opacity */
    spikeBoost: 0.35,    /* extra opacity added on an occasional bright flare */
    sizeBase: 1.3,        /* dot radius at its dimmest */
    sizeAmp: 1.1          /* how much bigger the dot gets at its brightest */
  }, intensity || {});

  var seeds = points.map(function(){
    /* Each point gets its own small irregular polygon (5-7 sided,
       jittered radius per vertex) so it reads as an organic sparkle
       rather than a perfect dot — real city lights never look like
       flawless circles. The shape itself is fixed per point (computed
       once here), only its overall scale pulses with the flicker. */
    var vertexCount = 5 + Math.floor(Math.random()*3);
    var shape = [];
    for(var i=0;i<vertexCount;i++){
      var angle = (i/vertexCount)*Math.PI*2 + (Math.random()-0.5)*0.4;
      var radiusMul = 0.55 + Math.random()*0.85;
      shape.push([angle, radiusMul]);
    }
    return {
      phase: Math.random()*Math.PI*2,
      speed: 0.5 + Math.random()*1.3,
      jitterPhase: Math.random()*Math.PI*2,
      jitterSpeed: 2 + Math.random()*5,
      shape: shape,
      rotation: Math.random()*Math.PI*2
    };
  });

  function resize(){
    var rect = img.getBoundingClientRect();
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);
  if(window.ResizeObserver){ new ResizeObserver(resize).observe(img); }

  /* object-fit:cover crops the image to fill its box — a naive
     fraction*containerSize mapping would misplace every point once
     that happens. This computes the real displayed scale/offset the
     browser uses for cover + the image's object-position, so points
     land on the same real pixels the crop is actually showing. */
  function mapPoint(fx, fy, w, h){
    if(!coverMode){ return [fx*w, fy*h]; }
    var natW = img.naturalWidth || w, natH = img.naturalHeight || h;
    var scale = Math.max(w/natW, h/natH);
    var renderedW = natW*scale, renderedH = natH*scale;
    var offsetX = (w - renderedW) * (coverMode.posX != null ? coverMode.posX : 0.5);
    var offsetY = (h - renderedH) * (coverMode.posY != null ? coverMode.posY : 0.5);
    return [offsetX + fx*renderedW, offsetY + fy*renderedH];
  }

  var start = performance.now();
  function frame(now){
    var t = (now - start) / 1000;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if(w && h){
      ctx.clearRect(0, 0, w, h);
      for(var i = 0; i < points.length; i++){
        var p = points[i], s = seeds[i];
        var base = cfg.minOpacity + cfg.ampMain * (0.5 + 0.5 * Math.sin(t*s.speed + s.phase));
        var jitter = Math.sin(t*s.jitterSpeed + s.jitterPhase);
        var opacity = base + (jitter > 0.86 ? cfg.spikeBoost : 0);
        opacity = Math.max(0.05, Math.min(1, opacity));
        var xy = mapPoint(p[0], p[1], w, h);
        var r = cfg.sizeBase + cfg.sizeAmp*base;
        ctx.beginPath();
        ctx.fillStyle = colorTemplate.replace('ALPHA', opacity.toFixed(2));
        for(var v=0; v<s.shape.length; v++){
          var vertAngle = s.shape[v][0] + s.rotation;
          var vertR = r * s.shape[v][1];
          var vx = xy[0] + Math.cos(vertAngle)*vertR;
          var vy = xy[1] + Math.sin(vertAngle)*vertR;
          if(v===0){ ctx.moveTo(vx,vy); } else { ctx.lineTo(vx,vy); }
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
