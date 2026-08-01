/* ============================================================
   MISSION MOUNTAIN ENGINE  (hybrid)
   name + domain -> shape ; steps -> height+camps ; switchback trail ;
   earned progress ; pickable style skin (shape stays the same).
   ============================================================ */
(function(global){
  'use strict';
  function hash(str){var h=2166136261>>>0;str=String(str||'mission');for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
  function rng(seed){var s=seed>>>0;return function(){s|=0;s=(s+0x6D2B79F5)|0;var t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

  var STYLES={
    alpine:{id:'alpine',label:'Alpine',rock:['#4a6694','#26395c','#0c1626'],sky:['#0c1834','#0a1222','#070b14'],glow:'rgba(120,170,255,0.18)',snow:'rgba(234,242,255,0.7)'},
    volcanic:{id:'volcanic',label:'Volcanic',rock:['#5a3030','#341818','#140808'],sky:['#2a0e0e','#1a0808','#0c0404'],glow:'rgba(255,120,60,0.22)',snow:'rgba(255,200,160,0.5)'},
    snow:{id:'snow',label:'Snow Peak',rock:['#8fa6c4','#5a7095','#2c3a55'],sky:['#16243f','#101a2e','#0a1018'],glow:'rgba(180,210,255,0.25)',snow:'rgba(255,255,255,0.85)'},
    desert:{id:'desert',label:'Desert Mesa',rock:['#b07a4a','#7a4f28','#3a2410'],sky:['#3a2a14','#2a1e10','#14100a'],glow:'rgba(255,200,120,0.22)',snow:'rgba(255,235,200,0.4)'},
    twilight:{id:'twilight',label:'Twilight',rock:['#5a4a80','#322850','#140e26'],sky:['#1a1240','#120c2c','#0a0618'],glow:'rgba(170,120,255,0.22)',snow:'rgba(234,230,255,0.6)'},
    emerald:{id:'emerald',label:'Emerald',rock:['#3a7a5a','#1e4a34','#0c2418'],sky:['#0c2a1e','#0a1e16','#06120c'],glow:'rgba(80,255,170,0.18)',snow:'rgba(220,255,240,0.5)'},
    obsidian:{id:'obsidian',label:'Obsidian',rock:['#3a3a48','#1e1e28','#0a0a10'],sky:['#14141c','#0e0e14','#08080c'],glow:'rgba(150,160,200,0.18)',snow:'rgba(220,225,240,0.55)'},
    crimson:{id:'crimson',label:'Crimson Dawn',rock:['#6a4a5a','#3a2434','#160c14'],sky:['#3a1428','#2a0e1c','#140610'],glow:'rgba(255,120,160,0.2)',snow:'rgba(255,220,235,0.55)'}
  };
  function styleList(){return Object.keys(STYLES).map(function(k){return {id:k,label:STYLES[k].label};});}

  var SUMMIT_X=46,BASE_Y=95,FOOT_LEFT=2,FOOT_RIGHT=98;
  function summitYForSteps(steps){var b=Math.min(1,Math.log((steps||1)+1)/Math.log(101));return Math.round(48-(48-8)*b);}
  function baseSurface(x,SY){if(x<=FOOT_LEFT||x>=FOOT_RIGHT)return BASE_Y;if(x<=SUMMIT_X){var f=(x-FOOT_LEFT)/(SUMMIT_X-FOOT_LEFT);return BASE_Y+(SY-BASE_Y)*Math.pow(f,1.2);}var g=(x-SUMMIT_X)/(FOOT_RIGHT-SUMMIT_X);return SY+(BASE_Y-SY)*Math.pow(g,1.05);}
  function makeSurface(SY,seed){var r=rng(seed);var p1=r()*6,p2=r()*6,p3=r()*6;return function(x){var np=Math.min(1,Math.abs(x-SUMMIT_X)/8);var n=-(Math.sin(x*0.4+p1)*2.4+Math.sin(x*0.9+p2)*1.4+Math.sin(x*0.22+p3)*2.8)*np*0.9;var y=baseSurface(x,SY)+n;return Math.max(SY,Math.min(BASE_Y,y));};}
  function edgesAtY(y,surf){var L=SUMMIT_X,R=SUMMIT_X;for(var x=FOOT_LEFT;x<=SUMMIT_X;x+=0.5){if(surf(x)<=y){L=x;break;}}for(var x2=FOOT_RIGHT;x2>=SUMMIT_X;x2-=0.5){if(surf(x2)<=y){R=x2;break;}}return [L,R];}
  function switchbackPath(steps,SY,surf,seed){var rand=rng(seed);var bends=Math.max(2,Math.min(7,Math.round((steps||1)/9)+2));var phase=rand()*0.8;var N=180,pts=[];for(var i=0;i<=N;i++){var p=i/N;var cy=(BASE_Y-1)+(SY-(BASE_Y-1))*p;var e=edgesAtY(cy,surf);var mid=(e[0]+e[1])/2,halfw=(e[1]-e[0])/2;var amp=halfw*0.6*(1-p*0.85);var x=mid+Math.sin(p*Math.PI*bends+phase)*amp;var cx=Math.max(e[0]+2,Math.min(e[1]-2,x));pts.push([cx,cy]);}pts[pts.length-1]=[SUMMIT_X,SY];return pts;}
  function ptAt(pts,p){var idx=Math.min(pts.length-1,Math.max(0,Math.round(p*(pts.length-1))));return pts[idx];}
  function smoothFrom(pts,count){var seg=pts.slice(0,count+1);if(seg.length<2)return '';var d='M '+seg[0][0].toFixed(1)+' '+seg[0][1].toFixed(1);for(var i=1;i<seg.length-1;i++){var mx=(seg[i][0]+seg[i+1][0])/2,my=(seg[i][1]+seg[i+1][1])/2;d+=' Q '+seg[i][0].toFixed(1)+' '+seg[i][1].toFixed(1)+', '+mx.toFixed(1)+' '+my.toFixed(1);}d+=' L '+seg[seg.length-1][0].toFixed(1)+' '+seg[seg.length-1][1].toFixed(1);return d;}
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  /* Same thresholds used everywhere else in AETHER (intelligenceEngine.js
     CAMP_THRESHOLDS) so the mountain's labeled camps always match what
     the rest of the app calls the current camp. */
  var CAMP_LEVELS=[
    {p:0,    name:'Base Camp'},
    {p:0.15, name:'Camp I'},
    {p:0.28, name:'Camp II'},
    {p:0.50, name:'Camp III'},
    {p:0.75, name:'Camp IV'},
    {p:0.90, name:'Camp V'},
    {p:1.00, name:'Summit'}
  ];

  /* Jagged distant-ridge silhouette used to fill the panoramic side
     zones on the hero variant — deterministic per seed, low amplitude,
     always anchored to the ground plane (y=100) so it reads as a
     continuous horizon rather than a floating shape. */
  function ridgePath(xStart,xEnd,seed,peakY,baseY){
    var r=rng(seed);
    var n=9;
    var d='M '+xStart.toFixed(1)+' 100 L '+xStart.toFixed(1)+' '+baseY.toFixed(1)+' ';
    for(var i=0;i<=n;i++){
      var x=xStart+(xEnd-xStart)*(i/n);
      var y=baseY-(baseY-peakY)*(0.25+0.75*r());
      d+='L '+x.toFixed(1)+' '+y.toFixed(1)+' ';
    }
    d+='L '+xEnd.toFixed(1)+' '+baseY.toFixed(1)+' L '+xEnd.toFixed(1)+' 100 Z';
    return d;
  }

  function render(opts){
    opts=opts||{};
    var name=opts.name||'Mission', domain=opts.domain||'';
    var checkpoints=opts.checkpoints||null;
    var steps=opts.steps||(checkpoints?checkpoints.length:0)||1;
    var styleId=(opts.style&&STYLES[opts.style])?opts.style:'alpine';
    var st=STYLES[styleId];
    var isHero=(opts.variant==='hero');
    var isDetail=(opts.variant!=='card' && opts.variant!=='hero');
    var accent='#4aa8ff';
    var doneCount=checkpoints?checkpoints.filter(function(c){return c.done;}).length:Math.round((opts.pct||0)/100*steps);
    var t=steps>0?Math.max(0,Math.min(doneCount/steps,1)):0;
    var seed=hash(name+'|'+domain);
    var SY=summitYForSteps(steps);
    var surf=makeSurface(SY,seed);
    var pts=switchbackPath(steps,SY,surf,seed);
    var drawCount=Math.round((pts.length-1)*t);
    var majors=steps<=12?steps:Math.min(10,Math.max(5,Math.round(Math.sqrt(steps))));
    var uid='mm'+(seed%100000);

    /* Always render the full mountain, base to peak — no cropped/zoomed
       variant. A tight summit-only crop on 'card' used to hide the base
       and the earned trail entirely, which is exactly what looked like
       "the summit is already reached" even when it wasn't. */
    var vbY=0, vbH=100;

    /* Hero variant: widen the canvas beyond the mountain's own 0-100
       coordinate space and fill the extra width with a panoramic
       backdrop (extra stars + two layers of distant ridgelines), so a
       wide banner container has no empty side gutters. The mountain
       itself (SUMMIT_X, trail, camps — all real progress data) stays
       exactly where it always was, centered in the original 0-100
       band. "slice" instead of "meet" guarantees full-bleed fill on
       any container aspect ratio, cropping panorama edges rather than
       ever showing blank space. */
    var PAD=isHero?70:0;
    var vbX=-PAD, vbW=100+PAD*2;

    var svg='<svg viewBox="'+vbX+' '+vbY+' '+vbW+' '+vbH+'" preserveAspectRatio="xMidYMid '+(isHero?'slice':'meet')+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">';
    svg+='<defs>';
    svg+='<linearGradient id="'+uid+'sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+st.sky[0]+'"/><stop offset="55%" stop-color="'+st.sky[1]+'"/><stop offset="100%" stop-color="'+st.sky[2]+'"/></linearGradient>';
    svg+='<radialGradient id="'+uid+'glow" cx="0.46" cy="0.12" r="0.7"><stop offset="0%" stop-color="'+st.glow+'"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>';
    svg+='<linearGradient id="'+uid+'rock" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0%" stop-color="'+st.rock[0]+'"/><stop offset="55%" stop-color="'+st.rock[1]+'"/><stop offset="100%" stop-color="'+st.rock[2]+'"/></linearGradient>';
    svg+='<filter id="'+uid+'g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0.5"/></filter>';
    svg+='</defs>';
    svg+='<rect x="'+vbX+'" y="0" width="'+vbW+'" height="100" fill="url(#'+uid+'sky)"/>';
    svg+='<rect x="'+vbX+'" y="0" width="'+vbW+'" height="100" fill="url(#'+uid+'glow)"/>';
    var sr=rng(seed+99);
    var starCount=isHero?Math.round(10*vbW/100):10;
    for(var s=0;s<starCount;s++){svg+='<circle cx="'+(vbX+sr()*vbW).toFixed(1)+'" cy="'+(sr()*30).toFixed(1)+'" r="'+(0.2+sr()*0.3).toFixed(2)+'" fill="rgba(255,255,255,'+(0.3+sr()*0.4).toFixed(2)+')"/>';}

    if(isHero && PAD>0){
      /* Far layer: dim, low, wide ridges — pure atmosphere. */
      svg+='<path d="'+ridgePath(vbX,0,seed+501,78,92)+'" fill="'+st.rock[2]+'" opacity="0.35"/>';
      svg+='<path d="'+ridgePath(100,vbX+vbW,seed+502,78,92)+'" fill="'+st.rock[2]+'" opacity="0.35"/>';
      /* Near layer: slightly taller/darker, closer to the main peak's
         tone, giving a sense of depth flanking the hero mountain. */
      svg+='<path d="'+ridgePath(vbX,0,seed+503,66,88)+'" fill="'+st.rock[1]+'" opacity="0.45"/>';
      svg+='<path d="'+ridgePath(100,vbX+vbW,seed+504,66,88)+'" fill="'+st.rock[1]+'" opacity="0.45"/>';
    }

    var sil='M 0 100 L 0 '+surf(0).toFixed(1)+' ';
    for(var x=0;x<=100;x+=1)sil+='L '+x+' '+surf(x).toFixed(2)+' ';
    sil+='L 100 100 Z';
    svg+='<path d="'+sil+'" fill="url(#'+uid+'rock)" stroke="rgba(180,205,255,0.3)" stroke-width="0.35" stroke-linejoin="round"/>';
    svg+='<path d="M '+SUMMIT_X+' '+SY+' L 100 '+BASE_Y+' L '+SUMMIT_X+' '+BASE_Y+' Z" fill="rgba(0,0,0,0.16)"/>';
    svg+='<path d="M '+SUMMIT_X+' '+SY+' L '+(SUMMIT_X-4)+' '+(SY+6)+' L '+(SUMMIT_X-1)+' '+(SY+4.5)+' L '+(SUMMIT_X+2)+' '+(SY+6.5)+' L '+(SUMMIT_X+4)+' '+(SY+5)+' Z" fill="'+st.snow+'"/>';

    if(drawCount>=1){
      var earned=smoothFrom(pts,drawCount);
      if(t>=1){
        // SUMMITED — pulsating glow on the whole trail, matching the
        // Twin Peaks "conquered" treatment: this mission is done.
        svg+='<path d="'+earned+'" fill="none" stroke="'+accent+'" stroke-width="1.6" stroke-linecap="round" filter="url(#'+uid+'g)" opacity="0.3">'+
               '<animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.6s" repeatCount="indefinite"/>'+
             '</path>';
        svg+='<path d="'+earned+'" fill="none" stroke="'+accent+'" stroke-width="0.6" stroke-dasharray="0.4 1.2" stroke-linecap="round" opacity="0.85">'+
               '<animate attributeName="opacity" values="0.7;1;0.7" dur="2.6s" repeatCount="indefinite"/>'+
             '</path>';
      } else {
        svg+='<path d="'+earned+'" fill="none" stroke="'+accent+'" stroke-width="1.1" opacity="0.16" filter="url(#'+uid+'g)" stroke-linecap="round"/>';
        svg+='<path d="'+earned+'" fill="none" stroke="'+accent+'" stroke-width="0.55" stroke-dasharray="0.4 1.2" stroke-linecap="round" opacity="0.95"/>';
      }
      for(var sft=1;sft<=steps;sft++){var pp=sft/(steps+1);if(pp>t)break;var tp=ptAt(pts,pp);svg+='<circle cx="'+tp[0].toFixed(1)+'" cy="'+tp[1].toFixed(1)+'" r="0.95" fill="'+accent+'" opacity="0.28" filter="url(#'+uid+'g)"/><circle cx="'+tp[0].toFixed(1)+'" cy="'+tp[1].toFixed(1)+'" r="0.55" fill="rgba(255,255,255,0.95)" stroke="'+accent+'" stroke-width="0.15"/>';}
    }
    /* Beyond current progress, show the remaining route as a faint,
       unearned guide — never dashed/bright like the earned portion —
       so it's visually obvious how much is left, not just implied. */
    if(t<1){
      var remaining=(function(){
        var seg=pts.slice(drawCount);
        if(seg.length<2) return '';
        var d='M '+seg[0][0].toFixed(1)+' '+seg[0][1].toFixed(1);
        for(var i=1;i<seg.length;i++){ d+=' L '+seg[i][0].toFixed(1)+' '+seg[i][1].toFixed(1); }
        return d;
      })();
      if(remaining) svg+='<path d="'+remaining+'" fill="none" stroke="rgba(180,195,220,0.28)" stroke-width="0.4" stroke-dasharray="0.2 1.6" stroke-linecap="round"/>';
    }
    svg+='<circle cx="'+pts[0][0].toFixed(1)+'" cy="'+pts[0][1].toFixed(1)+'" r="1.2" fill="'+accent+'" stroke="rgba(6,9,15,0.9)" stroke-width="0.3"/>';

    var labelsHtml='';
    /* Real, named camps — same thresholds the rest of AETHER uses — instead
       of generic evenly-spaced dots. Reached camps glow in the mission's
       accent color; camps still ahead render dim and outline-only so it's
       unambiguous which have actually been earned. */
    CAMP_LEVELS.forEach(function(camp){
      if(camp.p<=0 || camp.p>=1) return; /* base and summit are drawn separately */
      var reached=t>=camp.p;
      var cp=ptAt(pts,camp.p);
      var campColor=reached?accent:'rgba(170,190,220,0.4)';
      svg+='<circle cx="'+cp[0].toFixed(1)+'" cy="'+cp[1].toFixed(1)+'" r="1.6" fill="'+campColor+'" opacity="'+(reached?0.22:0.1)+'" filter="url(#'+uid+'g)"/>';
      svg+='<circle cx="'+cp[0].toFixed(1)+'" cy="'+cp[1].toFixed(1)+'" r="1.0" fill="'+(reached?campColor:'rgba(10,14,22,0.85)')+'" stroke="'+campColor+'" stroke-width="0.3"/>';
      if(isDetail){
        labelsHtml+='<div style="position:absolute;left:'+cp[0].toFixed(1)+'%;top:'+cp[1].toFixed(1)+'%;transform:translate(-50%,-170%);font-family:var(--font-mono,monospace);font-size:7.5px;letter-spacing:0.05em;color:'+(reached?'#eaf2ff':'rgba(190,200,220,0.55)')+';pointer-events:none;text-shadow:0 1px 4px #000;white-space:nowrap;">'+esc(camp.name)+'</div>';
      }
    });
    if(drawCount>=1){var head=ptAt(pts,t);svg+='<circle cx="'+head[0].toFixed(1)+'" cy="'+head[1].toFixed(1)+'" r="1.9" fill="'+accent+'" opacity="0.22" filter="url(#'+uid+'g)"/><circle cx="'+head[0].toFixed(1)+'" cy="'+head[1].toFixed(1)+'" r="1.15" fill="'+accent+'" stroke="rgba(6,9,15,0.9)" stroke-width="0.3"/>';}
    var summitReached=(t>=1);
    if(summitReached){
      svg+='<circle cx="'+SUMMIT_X+'" cy="'+SY+'" r="2.6" fill="#ffd166" opacity="0.3" filter="url(#'+uid+'g)">'+
             '<animate attributeName="opacity" values="0.22;0.6;0.22" dur="2.4s" repeatCount="indefinite"/>'+
             '<animate attributeName="r" values="2.2;3.6;2.2" dur="2.4s" repeatCount="indefinite"/>'+
           '</circle>';
    } else {
      svg+='<circle cx="'+SUMMIT_X+'" cy="'+SY+'" r="2.6" fill="#ffd166" opacity="0.12" filter="url(#'+uid+'g)"/>';
    }
    svg+='<circle cx="'+SUMMIT_X+'" cy="'+SY+'" r="1.7" fill="'+(summitReached?'#ffd166':'none')+'" stroke="'+(summitReached?'rgba(6,9,15,0.9)':'#ffd166')+'" stroke-width="0.4" opacity="'+(summitReached?1:0.55)+'"/>';
    svg+='</svg>';

    if(isDetail){
      labelsHtml+='<div style="position:absolute;left:'+SUMMIT_X+'%;top:'+SY+'%;transform:translate(-50%,-200%);font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:0.1em;color:'+(summitReached?'#ffd166':'rgba(255,209,102,0.6)')+';pointer-events:none;text-shadow:0 1px 5px #000;">'+(summitReached?'SUMMIT':'SUMMIT (NOT YET REACHED)')+'</div>';
    }
    return {svg:svg,labelsHtml:labelsHtml,meta:{steps:steps,majors:majors,summitY:SY,progress:Math.round(t*100),style:styleId}};
  }

  /* Given a total step count, returns which step number first crosses
     each camp threshold — the same doneCount/steps>=camp.p math the
     mountain itself uses to decide "reached." This is the single
     source of truth other pages (like the Blueprint checklist) use to
     label "reaching step N puts you at Camp X," so the checklist and
     the mountain graphic can never disagree. Base Camp (0%) is always
     step 0 / start, so it's excluded here. */
  function campMilestones(steps){
    steps=Math.max(1,steps||1);
    var out=[], lastStep=0;
    CAMP_LEVELS.forEach(function(camp){
      if(camp.p<=0) return;
      var stepNum=camp.p>=1?steps:Math.min(steps,Math.max(1,Math.ceil(camp.p*steps)));
      if(stepNum<=lastStep) return; /* short blueprints can collapse thresholds onto the same step — keep only the first camp that lands there */
      out.push({step:stepNum,name:camp.name});
      lastStep=stepNum;
    });
    return out;
  }

  function fromMission(mission){
    if(!mission)return {name:'Mission'};
    var cps=null;
    if(mission.milestones&&mission.milestones.length){
      var n=mission.milestones.length;
      var doneN=Math.round((mission.pct||0)/100*n);
      cps=mission.milestones.map(function(ms,i){return {label:ms.name||('Step '+(i+1)),done:i<doneN};});
    }
    return {name:mission.name,domain:(mission.domains&&mission.domains[0])||'',checkpoints:cps,steps:cps?cps.length:undefined,pct:mission.pct||0,style:mission.mountainStyle||'alpine'};
  }

  global.MissionMountain={render:render,fromMission:fromMission,campMilestones:campMilestones,STYLES:styleList(),_hash:hash};
})(typeof window!=='undefined'?window:this);
