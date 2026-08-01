/* ============================================================
   AETHER — INTELLIGENCE ENGINE (Phase 3)
   Teaches the brain how to think.

   This file does NOT store data. campaignStore.js (Phase 2) is
   still the single source of truth for facts. This file is a
   pure derivation layer: it reads facts via AetherStore.getX()
   and computes judgments from them.

   Hard rule this engine follows everywhere: every output must be
   traceable to a real input. There is no free-text generation,
   no invented numbers, no "AI-sounding" language standing in for
   an actual computation. If a threat says a mission is at risk,
   that conclusion is reconstructible from real mission/blocker
   fields, every time, the same way, given the same data.

   Loaded as window.AetherIntelligence, after campaignStore.js,
   before each page's own inline script - same file:// constraints
   as Phase 2, so this is a plain global script, not an ES module.
   ============================================================ */

(function(global){
  'use strict';

  if(!global.AetherStore){
    console.error('AetherIntelligence: AetherStore must be loaded first.');
    return;
  }
  var Store = global.AetherStore;

  /* ============================================================
     1. THREATS
     A threat is anything actively working against the campaign
     right now. Two sources, both real:
       - missions with status 'warning' or 'critical'
       - blockers with status 'open' and severity 'High'
     ============================================================ */
  function computeThreats(){
    var missions = Store.getAllMissions ? Store.getAllMissions() : Store.getMissions();
    var blockers = Store.getAllBlockers ? Store.getAllBlockers() : Store.getBlockers();
    var threats = [];
    var seenMissionNames = {};

    /* Blockers take priority: a High-severity open blocker is the
       most specific, most actionable threat. If a mission's own
       warning/critical status is just a symptom of that same
       blocker, it should not be reported twice. */
    blockers.forEach(function(b){
      if(b.status === 'open' && b.severity === 'High'){
        threats.push({
          name: b.affectedMission,
          sub: b.name,
          sourceType: 'blocker',
          sourceKey: b.key,
          severity: 'High'
        });
        seenMissionNames[b.affectedMission] = true;
      }
    });

    missions.forEach(function(m){
      if((m.status === 'critical' || m.status === 'warning') && !seenMissionNames[m.name]){
        var reason = m.blocked
          ? m.blocker + ' (' + m.stalledDays + ' days stalled)'
          : 'Status: ' + (m.status === 'critical' ? 'Critical' : 'Warning') + ', ' + m.pct + '% progress';
        threats.push({
          name: m.name,
          sub: reason,
          sourceType: 'mission',
          sourceKey: m.key,
          severity: m.status === 'critical' ? 'High' : 'Medium'
        });
        seenMissionNames[m.name] = true;
      }
    });

    threats.sort(function(a,b){
      if(a.severity === b.severity) return a.name.localeCompare(b.name);
      return a.severity === 'High' ? -1 : 1;
    });

    return threats;
  }

  /* ============================================================
     2. OPPORTUNITIES
     The fastest available confidence gains: advancing missions,
     ranked by their real confidenceGain field, highest first.
     ============================================================ */
  function computeOpportunities(){
    var missions = Store.getAllMissions ? Store.getAllMissions() : Store.getMissions();

    var candidates = missions.filter(function(m){
      return (m.status === 'advancing' || m.status === 'stable') && m.pct < 100;
    });

    candidates.sort(function(a,b){ return b.confidenceGain - a.confidenceGain; });

    return candidates.slice(0,4).map(function(m){
      return {
        name: m.name,
        gain: '+' + m.confidenceGain + ' Confidence',
        sourceKey: m.key
      };
    });
  }

  /* ============================================================
     3. RECENT VICTORIES
     Verified or resolved events from the real timeline, most
     recent first.
     ============================================================ */
  function computeVictories(limit){
    var events = Store.getTimelineEvents();
    var n = limit || 5;

    var wins = events.filter(function(e){
      return e.type === 'verified' || e.type === 'resolved';
    });

    return wins.slice(0, n).map(function(e){
      return { name: e.name, sub: e.sub };
    });
  }

  /* ============================================================
     4. COMMANDER CONFIDENCE
     Same philosophy already proven in blueprint-detail.html and
     evidence-vault.html: verified evidence contributes full
     confidence, unverified contributes 40%, open High-severity
     blockers subtract a fixed penalty. This is a weighted sum,
     not a guess.
     ============================================================ */
  function computeCommanderConfidence(){
    var evidence = Store.getEvidence();
    var blockers = Store.getAllBlockers ? Store.getAllBlockers() : Store.getBlockers();

    var earned = evidence.reduce(function(sum, e){
      var status = e.defaultStatus;
      if(status === 'verified') return sum + e.confidenceValue;
      if(status === 'pending') return sum + Math.round(e.confidenceValue * 0.4);
      return sum;
    }, 0);

    var maxPossible = evidence.reduce(function(sum, e){ return sum + e.confidenceValue; }, 0);

    var highBlockerPenalty = blockers.filter(function(b){
      return b.status === 'open' && b.severity === 'High';
    }).length * 5; /* fixed penalty per open high-severity blocker */

    var basePct = maxPossible > 0 ? Math.round((earned / maxPossible) * 100) : 0;
    var finalPct = Math.max(0, basePct - highBlockerPenalty);

    return {
      pct: finalPct,
      earned: earned,
      maxPossible: maxPossible,
      highBlockerPenalty: highBlockerPenalty
    };
  }

  /* ============================================================
     5. TODAY'S COMMAND
     The single highest-leverage action right now. Priority order:
       1. The highest-severity OPEN blocker on the lead mission
          (lead mission = highest pct among non-blocked missions)
       2. Otherwise, the advancing mission with the highest
          confidenceGain, pointed at its real next milestone.
     ============================================================ */
  function computeTodaysCommand(){
    var missions = Store.getAllMissions ? Store.getAllMissions() : Store.getMissions();
    var blockers = Store.getAllBlockers ? Store.getAllBlockers() : Store.getBlockers();

    if(missions.length === 0){
      return null; /* no data, caller must show empty state */
    }

    var leadMission = missions.slice().sort(function(a,b){ return b.pct - a.pct; })[0];

    var leadBlocker = blockers.find(function(b){
      return b.status === 'open' && b.affectedMission === leadMission.name && b.severity === 'High';
    });

    if(leadBlocker){
      return {
        type: 'blocker',
        missionName: leadMission.name,
        camp: leadMission.camp,
        title: leadBlocker.name,
        action: leadBlocker.recoveryPlan,
        confidenceGain: 5, /* fixed value: resolving a High blocker always carries real weight */
        whyItMatters: 'This blocker is actively stalling ' + leadMission.name + ', the campaign\u2019s lead expedition.'
      };
    }

    /* A mission already at 100% has nothing left to advance — suggesting
       it again as "today's command" is exactly the stale loop that made
       a finished mission keep saying "Continue current phase." Only
       missions genuinely still in motion are real candidates. */
    var topOpportunity = missions
      .filter(function(m){ return m.pct < 100 && (m.status === 'advancing' || m.status === 'stable'); })
      .sort(function(a,b){ return b.confidenceGain - a.confidenceGain; })[0];

    if(!topOpportunity){
      /* Every mission that exists is fully summited and there's no
         open blocker either — this is a genuine "nothing left to
         climb" state, not a data gap. Tell the caller so it can show
         a real "what's next" prompt instead of a stale suggestion. */
      var anyIncomplete = missions.some(function(m){ return m.pct < 100; });
      if(!anyIncomplete){
        return {
          type: 'all-complete',
          missionName: null,
          camp: null,
          title: 'Every mission is summited.',
          action: null,
          confidenceGain: 0,
          whyItMatters: 'All ' + missions.length + ' mission' + (missions.length===1?'':'s') + ' currently tracked ' + (missions.length===1?'has':'have') + ' reached 100%. Start a new one to keep climbing.'
        };
      }
      return null;
    }

    var nextMilestone = topOpportunity.milestones && topOpportunity.milestones[0]
      ? topOpportunity.milestones[0].name
      : 'Continue current phase';

    return {
      type: 'milestone',
      missionName: topOpportunity.name,
      camp: topOpportunity.camp,
      title: nextMilestone,
      action: nextMilestone,
      confidenceGain: topOpportunity.confidenceGain,
      whyItMatters: topOpportunity.name + ' is advancing and has the highest available confidence gain right now.'
    };
  }

  /* ============================================================
     6. EXECUTIVE INTELLIGENCE
     One real bullet per notable signal: rising domains, declining
     domains, and high-severity blockers. No filler bullets, no
     bullets when there's nothing to report.
     ============================================================ */
  function computeExecutiveIntelligence(){
    var domains = Store.getDomains();
    var blockers = Store.getAllBlockers ? Store.getAllBlockers() : Store.getBlockers();
    var bullets = [];

    domains.forEach(function(d){
      if(d.trend === 'up' || d.trend === 'strong'){
        bullets.push({ tone:'good', text: d.name + ' showing ' + (d.trend === 'strong' ? 'strong' : 'steady') + ' progress at ' + d.pct + '%.' });
      } else if(d.trend === 'down'){
        bullets.push({ tone:'bad', text: d.name + ' is declining, currently at ' + d.pct + '%.' });
      }
    });

    blockers.forEach(function(b){
      if(b.status === 'open' && b.severity === 'High'){
        bullets.push({ tone:'bad', text: b.affectedMission + ' blocked: ' + b.name + '.' });
      }
    });

    return bullets;
  }

  /* ============================================================
     7. RECOVERY PLANS
     The engine does not invent recovery language. It packages
     and prioritizes the real recoveryPlan text already attached
     to each open blocker, ranked by severity then days open.
     ============================================================ */
  function computeRecoveryPlans(){
    var blockers = Store.getAllBlockers ? Store.getAllBlockers() : Store.getBlockers();
    var severityRank = { High:0, Medium:1, Low:2 };

    return blockers
      .filter(function(b){ return b.status === 'open' || b.status === 'progress'; })
      .sort(function(a,b){
        var sevDiff = severityRank[a.severity] - severityRank[b.severity];
        if(sevDiff !== 0) return sevDiff;
        return b.daysOpen - a.daysOpen;
      })
      .map(function(b){
        return {
          blockerName: b.name,
          affectedMission: b.affectedMission,
          severity: b.severity,
          plan: b.recoveryPlan,
          daysOpen: b.daysOpen
        };
      });
  }

  /* ============================================================
     8. DOMAIN BOARD (Command Deck shape)
     Converts the real getDomains() list (Life Elevation Engine
     shape) into the glyph/weather shape Command Deck's domain
     board expects, instead of maintaining a second hand-written
     array. Weather and short labels are derived deterministically
     from trend + pct, not invented per domain.
     ============================================================ */
  var GLYPH_MAP = {
    health:'❤', finance:'$', relationships:'♥', learning:'▤', business:'◆',
    skills:'★', character:'◇', spiritual:'☀', purpose:'◎', environment:'❖'
  };
  var SUB_LABEL_MAP = {
    health:'Build Foundation', finance:'Build Wealth', relationships:'Deepen Bonds',
    learning:'Build Knowledge', business:'Foundation', skills:'Develop Skills',
    character:'Build Discipline', spiritual:'Inner Growth', purpose:'Clarify Purpose',
    environment:'Optimize Space'
  };
  function deriveWeather(trend, pct){
    if(trend === 'down') return {weather:'storm', wlabel:'Storm Front'};
    if(trend === 'flat' && pct < 40) return {weather:'fog', wlabel:'Heavy Fog'};
    if(trend === 'flat') return {weather:'light_clouds', wlabel:'Light Clouds'};
    if(trend === 'strong') return {weather:'clear', wlabel:'Clear Skies'};
    return {weather:'light_clouds', wlabel:'Light Clouds'};
  }

  var SHORT_NAME_MAP = {
    health:'Health', finance:'Finance', relationships:'Relationships', learning:'Learning',
    business:'Business', skills:'Skills & Mastery', character:'Character', spiritual:'Spiritual',
    purpose:'Purpose & Mission', environment:'Environment'
  };

  function computeDashboardDomains(){
    var domains = Store.getDomains();
    return domains.map(function(d){
      var w = deriveWeather(d.trend, d.pct);
      return {
        name: SHORT_NAME_MAP[d.key] || d.name,
        icon: GLYPH_MAP[d.key] || '●',
        color: d.color,
        pct: d.pct,
        trend: d.trend,
        camp: d.camp,
        sub: SUB_LABEL_MAP[d.key] || d.name,
        weather: w.weather,
        wlabel: w.wlabel
      };
    });
  }

  /* ============================================================
     9. CONFIDENCE HISTORY (7-day trend)
     Built from confidence-affecting timeline events. Each verified
     event's delta is applied cumulatively backward from today's
     computed confidence so the chart always ends at the real
     current value rather than an arbitrary number.
     ============================================================ */
  function computeConfidenceHistory(){
    var events = Store.getTimelineEvents();
    var current = computeCommanderConfidence().pct;

    var dayOrder = [];
    events.forEach(function(e){ if(dayOrder.indexOf(e.day) === -1) dayOrder.push(e.day); });
    dayOrder.reverse(); /* oldest first for a left-to-right chart */

    var running = current;
    var perDayDelta = {};
    dayOrder.forEach(function(day){ perDayDelta[day] = 0; });
    events.forEach(function(e){
      var v = parseInt(e.delta);
      if(!isNaN(v) && perDayDelta.hasOwnProperty(e.day)) perDayDelta[e.day] += v;
    });

    var totalDelta = 0;
    dayOrder.forEach(function(day){ totalDelta += perDayDelta[day]; });
    running = current - totalDelta;

    return dayOrder.map(function(day){
      running += perDayDelta[day];
      return { day: day, val: running };
    });
  }

  /* ============================================================
     10. LIFE ELEVATION
     The same weighted-average formula already proven in
     life-advancement.html, now centralized so both pages compute
     it identically instead of maintaining two copies of the math.
     ============================================================ */
  function computeLifeElevation(){
    var domains = Store.getDomains();
    if(domains.length === 0) return 0;
    var totalWeight = domains.reduce(function(s,d){ return s + d.weight; }, 0);
    if(totalWeight === 0) return 0;
    return Math.round(domains.reduce(function(s,d){ return s + (d.pct * d.weight); }, 0) / totalWeight);
  }

  /* ============================================================
     11. CURRENT CAMP
     Derived directly from Life Elevation, using the same camp
     thresholds already established across Life Advancement and
     the Blueprint system (Base Camp at 0%, Camp I at 15%, etc).
     ============================================================ */
  var CAMP_THRESHOLDS = [
    {min:90, name:'Camp V'}, {min:75, name:'Camp IV'}, {min:50, name:'Camp III'},
    {min:28, name:'Camp II'}, {min:15, name:'Camp I'}, {min:0, name:'Base Camp'}
  ];
  function computeCurrentCamp(){
    var pct = computeLifeElevation();
    for(var i=0; i<CAMP_THRESHOLDS.length; i++){
      if(pct >= CAMP_THRESHOLDS[i].min) return CAMP_THRESHOLDS[i].name;
    }
    return 'Base Camp';
  }

  /* ============================================================
     12. SUMMIT ETA
     Honest constraint: the only real historical signal available
     right now is confidence-point deltas from timeline events,
     which is a different metric than Life Elevation percentage
     (a weighted average of domain pct). Projecting one from the
     other would produce a plausible-looking but methodologically
     unsound number. Until Life Elevation itself has enough real
     historical snapshots (Phase 4 / real campaign data over many
     days), Summit ETA is honestly reported as unavailable rather
     than computed from a mismatched metric. The minimum threshold
     below (at least 14 distinct days of data) is a placeholder
     guard, not a tuned constant; revisit once real elevation
     history exists.
     ============================================================ */
  var MIN_DAYS_FOR_ETA = 14;
  function computeSummitETA(){
    var currentPct = computeLifeElevation();
    var events = Store.getTimelineEvents();

    var dayOrder = [];
    events.forEach(function(e){ if(dayOrder.indexOf(e.day) === -1) dayOrder.push(e.day); });

    if(dayOrder.length < MIN_DAYS_FOR_ETA || currentPct >= 100){
      return {
        years: null, months: null,
        label: 'Insufficient History',
        reason: dayOrder.length + ' of ' + MIN_DAYS_FOR_ETA + ' days of campaign history recorded'
      };
    }

    /* Once enough real Life Elevation history exists (Phase 4),
       this should compute velocity from actual elevation deltas
       between dated snapshots, not from confidence-point events. */
    return { years: null, months: null, label: 'Not Yet Computable', reason: 'Elevation history tracking not yet implemented' };
  }

  /* ============================================================
     13. DEBRIEF INTELLIGENCE
     This is the actual differentiator: pattern detection over what
     the operator wrote in past debriefs, not just numeric mission
     fields. The method here is intentionally simple and disclosed:
     substring matching of each real mission name against the
     'failed' text of each debrief, in chronological order. This is
     keyword matching, not language understanding - it cannot know
     WHY a mission was avoided, only THAT the same mission name
     keeps appearing in "what failed" across consecutive entries.
     Every pattern returned carries the exact debrief dates that
     produced it, so the conclusion is independently checkable
     against the source text.
     ============================================================ */

  function detectRecurringAvoidance(){
    var debriefs = Store.getAllDebriefs ? Store.getAllDebriefs() : Store.getPastDebriefs();
    var missions = Store.getAllMissions ? Store.getAllMissions() : Store.getMissions();
    var patterns = [];

    missions.forEach(function(m){
      if(m.pct >= 100) return; /* summited -- not an active avoidance pattern anymore */
      var trailing = [];
      for(var j=debriefs.length-1; j>=0; j--){
        var f = (debriefs[j].failed || '').toLowerCase();
        if(f.indexOf(m.name.toLowerCase()) !== -1){
          trailing.unshift(debriefs[j].date);
        } else {
          break;
        }
      }
      if(trailing.length >= 2){
        patterns.push({
          missionName: m.name,
          missionKey: m.key,
          consecutiveDebriefs: trailing.length,
          dates: trailing,
          confidenceGainAtStake: m.confidenceGain
        });
      }
    });

    return patterns;
  }

  function detectRecurringBlockers(){
    var blockers = Store.getAllBlockers ? Store.getAllBlockers() : Store.getBlockers();
    return blockers
      .filter(function(b){ return b.status === 'open' && b.daysOpen >= 3; })
      .map(function(b){
        return {
          blockerName: b.name,
          affectedMission: b.affectedMission,
          daysOpen: b.daysOpen,
          severity: b.severity,
          recoveryPlan: b.recoveryPlan
        };
      })
      .sort(function(a,b){ return b.daysOpen - a.daysOpen; });
  }

  function detectSuccessStreaks(){
    var debriefs = Store.getAllDebriefs ? Store.getAllDebriefs() : Store.getPastDebriefs();
    if(debriefs.length === 0) return { streakLength: 0, dates: [] };

    var trailing = [];
    for(var i=debriefs.length-1; i>=0; i--){
      if(debriefs[i].worked && debriefs[i].worked.trim().length > 0){
        trailing.unshift(debriefs[i].date);
      } else {
        break;
      }
    }
    return { streakLength: trailing.length, dates: trailing };
  }

  function detectConfidenceTrend(){
    var debriefs = Store.getAllDebriefs ? Store.getAllDebriefs() : Store.getPastDebriefs();
    if(debriefs.length < 2) return { direction:'unknown', totalChange:0, dates:[] };

    var totalChange = debriefs.reduce(function(sum, d){ return sum + (d.confidenceChange || 0); }, 0);
    var recentHalf = debriefs.slice(Math.ceil(debriefs.length/2));
    var recentChange = recentHalf.reduce(function(sum, d){ return sum + (d.confidenceChange || 0); }, 0);
    var earlierHalf = debriefs.slice(0, Math.floor(debriefs.length/2));
    var earlierChange = earlierHalf.reduce(function(sum, d){ return sum + (d.confidenceChange || 0); }, 0);

    var direction = 'flat';
    if(recentChange < earlierChange) direction = 'declining';
    else if(recentChange > earlierChange) direction = 'improving';

    return {
      direction: direction,
      totalChange: totalChange,
      recentHalfChange: recentChange,
      earlierHalfChange: earlierChange,
      dates: debriefs.map(function(d){ return d.date; })
    };
  }

  function detectBehaviorDrift(){
    var avoidance = detectRecurringAvoidance();
    var trend = detectConfidenceTrend();
    var drifts = [];

    avoidance.forEach(function(a){
      if(a.consecutiveDebriefs >= 3){
        drifts.push({
          type: 'avoidance',
          summary: a.missionName + ' has been avoided for ' + a.consecutiveDebriefs + ' consecutive debriefs.',
          dates: a.dates,
          confidenceImpact: -1 * a.confidenceGainAtStake,
          recommendedAction: 'Schedule dedicated time on ' + a.missionName + ' tomorrow before starting anything else.'
        });
      }
    });

    if(trend.direction === 'declining' && trend.dates.length >= 3){
      drifts.push({
        type:'confidence_decline',
        summary: 'Confidence gains have slowed over the last ' + trend.dates.length + ' debriefs (' + trend.earlierHalfChange + ' -> ' + trend.recentHalfChange + ').',
        dates: trend.dates,
        confidenceImpact: trend.recentHalfChange - trend.earlierHalfChange,
        recommendedAction: 'Review open blockers before starting new work; unresolved blockers are the most common cause of slowing confidence.'
      });
    }

    return drifts;
  }

  /* ============================================================
     14. TOMORROW'S COMMAND
     The single highest-leverage action for tomorrow, prioritized:
       1. A behavior drift (avoidance pattern at 3+ consecutive
          debriefs) - the most costly, least visible problem.
       2. A recurring blocker open 3+ days - concrete and actionable.
       3. Otherwise, fall back to today's normal computeTodaysCommand()
          logic, since there's no behavioral signal strong enough
          to override the standard recommendation.
     Every branch states which source data produced it.
     ============================================================ */
  function computeTomorrowCommand(){
    var drifts = detectBehaviorDrift();
    var avoidanceDrift = drifts.find(function(d){ return d.type === 'avoidance'; });

    if(avoidanceDrift){
      return {
        type: 'behavior_pattern',
        title: 'Recurring Avoidance Pattern: ' + avoidanceDrift.summary.split(' has been')[0],
        summary: avoidanceDrift.summary,
        action: avoidanceDrift.recommendedAction,
        confidenceImpact: avoidanceDrift.confidenceImpact,
        sourceDates: avoidanceDrift.dates,
        whyChosen: 'Detected by scanning "What Failed" across the last ' + avoidanceDrift.dates.length + ' debriefs (' + avoidanceDrift.dates.join(', ') + ') for the same mission name appearing every time.'
      };
    }

    var recurringBlockers = detectRecurringBlockers();
    if(recurringBlockers.length > 0){
      var rb = recurringBlockers[0];
      return {
        type: 'recurring_blocker',
        title: 'Unresolved Blocker: ' + rb.blockerName,
        summary: rb.blockerName + ' has been open for ' + rb.daysOpen + ' days, affecting ' + rb.affectedMission + '.',
        action: rb.recoveryPlan,
        confidenceImpact: null,
        sourceDates: [],
        whyChosen: 'This blocker has the longest open duration (' + rb.daysOpen + ' days) of any ' + rb.severity + '-severity blocker currently open.'
      };
    }

    var fallback = computeTodaysCommand();
    if(!fallback) return null;

    return {
      type: 'standard_recommendation',
      title: fallback.title,
      summary: fallback.whyItMatters,
      action: fallback.action,
      confidenceImpact: fallback.confidenceGain,
      sourceDates: [],
      whyChosen: 'No behavior pattern or aging blocker outranked the standard highest-leverage mission recommendation.'
    };
  }

  global.AetherIntelligence = {
    computeThreats: computeThreats,
    computeOpportunities: computeOpportunities,
    computeVictories: computeVictories,
    computeCommanderConfidence: computeCommanderConfidence,
    computeTodaysCommand: computeTodaysCommand,
    computeExecutiveIntelligence: computeExecutiveIntelligence,
    computeRecoveryPlans: computeRecoveryPlans,
    computeDashboardDomains: computeDashboardDomains,
    computeConfidenceHistory: computeConfidenceHistory,
    computeLifeElevation: computeLifeElevation,
    computeCurrentCamp: computeCurrentCamp,
    computeSummitETA: computeSummitETA,
    detectRecurringAvoidance: detectRecurringAvoidance,
    detectRecurringBlockers: detectRecurringBlockers,
    detectSuccessStreaks: detectSuccessStreaks,
    detectConfidenceTrend: detectConfidenceTrend,
    detectBehaviorDrift: detectBehaviorDrift,
    computeTomorrowCommand: computeTomorrowCommand
  };

})(window);
