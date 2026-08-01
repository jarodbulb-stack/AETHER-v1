/* ============================================================
   AETHER — DAILY COMMAND ENGINE (Phase 4B)
   Converts intelligence engine output into a committable daily
   command record that connects morning intent to evening debrief.

   Depends on: campaignStore.js, intelligenceEngine.js
   Exposes: window.DailyCommand

   Architecture:
   - computeForToday()  — derives the command from real data
   - accept(cmd)        — writes an ACCEPTED record to localStorage
   - modify(cmd, text)  — writes a MODIFIED record with operator text
   - defer(cmd)         — writes a DEFERRED record, returns next best
   - getRecord(dateKey) — reads any past record by date key
   - getTodayRecord()   — reads today's record if it exists
   - completeCommand()  — marks today's command as completed (evening)
   - failCommand(reason)— marks today's command as not completed

   Record shape (stored as JSON in localStorage):
   {
     dateKey:      'YYYY-MM-DD',          // lookup key
     dateLabel:    'Jun 22, 2026',        // display label
     status:       'accepted'|'modified'|'deferred'|'completed'|'failed',
     command: {
       type:         'blocker'|'milestone'|'behavior_pattern'|'checkpoint'|'manual',
       missionName:  string,
       camp:         string,
       title:        string,
       action:       string,
       confidenceGain: number,
       whyItMatters: string,
       estimatedMinutes: number,
     },
     operatorNote:  string,               // set on MODIFY
     completedAt:   ISO string | null,
     failReason:    string | null,
     acceptedAt:    ISO string
   }
   ============================================================ */

(function(global){
  'use strict';

  if(!global.AetherStore){
    console.error('DailyCommand: AetherStore must be loaded first.');
    return;
  }
  if(!global.AetherIntelligence){
    console.error('DailyCommand: AetherIntelligence must be loaded first.');
    return;
  }

  var Store = global.AetherStore;
  var Intel = global.AetherIntelligence;

  /* ---------- Storage key helpers ---------- */
  var CMD_PREFIX = 'aether_daily_cmd_';

  function todayKey(){
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth()+1).padStart(2,'0');
    var day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }

  function todayLabel(){
    var d = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
    var days   = ['Sunday','Monday','Tuesday','Wednesday',
                  'Thursday','Friday','Saturday'];
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function keyFor(dateKey){ return CMD_PREFIX + dateKey; }

  function lsRead(dateKey){
    try{
      var raw = localStorage.getItem(keyFor(dateKey));
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  function lsWrite(dateKey, record){
    try{
      localStorage.setItem(keyFor(dateKey), JSON.stringify(record));
      return true;
    }catch(e){
      console.warn('DailyCommand: localStorage write failed', e);
      return false;
    }
  }

  /* ---------- Time estimate ---------- */
  /* Every command type gets a default estimate. Operator can see this
     in the morning and decide whether it's realistic before accepting. */
  function estimateMinutes(cmdType, title){
    if(cmdType === 'blocker')           return 45;
    if(cmdType === 'behavior_pattern')  return 60;
    if(cmdType === 'checkpoint'){
      /* Checkpoints are concrete tasks — estimate from name length as a
         rough proxy: longer names tend to be more complex tasks */
      var words = (title || '').split(' ').length;
      return words > 6 ? 90 : 60;
    }
    /* milestone / standard_recommendation */
    return 90;
  }

  /* ============================================================
     COMMAND SELECTION — FULL 5-PRIORITY ENGINE
     Every priority level cites the exact source data that
     triggered it. No invented reasoning. No guesses.

     Priority 1 — Critical blocker on any live mission (High severity, open)
                  Source: AetherStore.getAllBlockers()
                  Reason cited: blocker name + affected mission + days open

     Priority 2 — Recurring avoidance OR recurring deferral pattern
                  Source: getAllDebriefs() → detectRecurringAvoidance()
                          getDeferLog()    → getRecurringDeferrals()
                  Reason cited: mission name + consecutive debrief/defer count + dates

     Priority 3 — Next uncompleted live checkpoint (highest-leverage)
                  Source: getLiveBlueprints() + getCheckpointsForBlueprint()
                  Reason cited: checkpoint name + blueprint name + confidence value

     Priority 4 — Highest confidence-gain opportunity from intel engine
                  Source: AetherIntelligence.computeTodaysCommand()
                  Reason cited: mission name + next milestone + confidenceGain

     Priority 5 — Momentum preservation: stalled mission or stalled checkpoint
                  Source: getAllMissions() where stalledDays > 2 and not blocked
                  Reason cited: mission name + days stalled

     If already committed today → return committed record (no re-derivation).
     ============================================================ */

  function computeForToday(){
    /* Guard: already committed today — do not re-derive */
    var existing = lsRead(todayKey());
    if(existing && (existing.status === 'accepted' || existing.status === 'modified')){
      return { source: 'committed', record: existing };
    }

    /* ---- All real missions summited — nothing left to defer, block, or
       checkpoint against. dashboard.html already has a dedicated "All
       Missions Summited → New Mission" prompt for exactly this state
       (result.command.type === 'all-complete'), but nothing ever
       produced that type, so a fully-completed campaign fell through
       to whatever stale pattern happened to be in the defer/avoidance
       history (e.g. a mission deferred twice months ago, long since
       finished) instead of recognizing the real, current state: done.
       Checked before P1-P5 since none of those are meaningful once
       every mission is at 100%. */
    var allMissions = Store.getAllMissions ? Store.getAllMissions() : Store.getMissions();
    if(allMissions.length > 0 && allMissions.every(function(m){ return m.pct >= 100; })){
      return {
        source: 'all-complete',
        command: {
          type:         'all-complete',
          title:        'All Missions Summited',
          action:       'Start your next mission.',
          whyItMatters: allMissions.length === 1
            ? 'You\'ve summited "' + allMissions[0].name + '." Every real mission is complete — set your next one to keep climbing.'
            : 'All ' + allMissions.length + ' active missions are summited. Every real mission is complete — set your next one to keep climbing.',
          confidenceGain:   0,
          estimatedMinutes: 0
        }
      };
    }

    /* ---- Priority 1: Critical blocker on a live mission ---- */
    var p1 = selectPriority1();
    if(p1) return { source: 'blocker', command: p1 };

    /* ---- Priority 2: Recurring avoidance or recurring deferral ---- */
    var p2 = selectPriority2();
    if(p2) return { source: 'pattern', command: p2 };

    /* ---- Priority 3: Next live checkpoint ---- */
    var p3 = findNextLiveCheckpoint();
    if(p3){
      var cmd3 = {
        type:             'checkpoint',
        missionName:      p3.missionName,
        blueprintName:    p3.blueprintName,
        camp:             p3.camp,
        title:            p3.cpName,
        action:           p3.cpName,
        confidenceGain:   p3.confidenceValue,
        whyItMatters:     p3.cpName + ' is the next uncompleted checkpoint in ' +
                          p3.blueprintName + '. Completing it advances ' +
                          p3.missionName + ' and earns +' + p3.confidenceValue + ' confidence.',
        estimatedMinutes: estimateMinutes('checkpoint', p3.cpName),
        checkpointId:     p3.cpId,
        blueprintKey:     p3.blueprintKey
      };
      return { source: 'checkpoint', command: cmd3 };
    }

    /* ---- Priority 4: Intelligence engine (highest confidence gain) ---- */
    var intelCmd = Intel.computeTodaysCommand();
    if(intelCmd){
      intelCmd.estimatedMinutes = estimateMinutes(intelCmd.type, intelCmd.title);
      return { source: 'intelligence', command: intelCmd };
    }

    /* ---- Priority 5: Momentum — stalled mission not yet blocked ---- */
    var p5 = selectPriority5();
    if(p5) return { source: 'momentum', command: p5 };

    return { source: 'empty', command: null };
  }

  /* ---- P1: Critical blocker ---- */
  function selectPriority1(){
    var blockers = Store.getAllBlockers ? Store.getAllBlockers() : Store.getBlockers();
    var missions  = Store.getAllMissions ? Store.getAllMissions() : Store.getMissions();

    /* Only live missions matter for command selection — sample missions
       may also have blockers but operator can't act on them directly */
    var liveMissionNames = (Store.getLiveMissions ? Store.getLiveMissions() : [])
      .map(function(m){ return m.name; });

    /* Find the highest-severity open blocker on a live mission */
    var critical = blockers
      .filter(function(b){
        return b.status === 'open' &&
               b.severity === 'High' &&
               liveMissionNames.indexOf(b.affectedMission) !== -1;
      })
      .sort(function(a,b){ return (b.daysOpen||0) - (a.daysOpen||0); })[0];

    if(!critical) return null;

    var mission = missions.find(function(m){ return m.name === critical.affectedMission; });
    var daysText = critical.daysOpen > 0
      ? critical.daysOpen + ' day' + (critical.daysOpen !== 1 ? 's' : '') + ' open'
      : 'Just discovered';

    return {
      type:             'blocker',
      missionName:      critical.affectedMission,
      camp:             mission ? mission.camp : 'Unknown',
      title:            'Resolve: ' + critical.name,
      action:           critical.recoveryPlan || 'Execute blocker recovery plan',
      confidenceGain:   5,
      whyItMatters:     'Priority 1 — Critical blocker. ' + critical.name +
                        ' is actively stalling ' + critical.affectedMission +
                        ' (' + daysText + '). No other work advances the campaign while this is open.',
      estimatedMinutes: 60,
      blockerKey:       critical.key,
      sourceLabel:      'Blocker: ' + critical.name + ' · ' + daysText
    };
  }

  /* ---- P2: Recurring avoidance or recurring deferral ---- */
  function selectPriority2(){
    /* Check avoidance patterns from debriefs */
    var avoidance = Intel.detectRecurringAvoidance ? Intel.detectRecurringAvoidance() : [];
    if(avoidance.length > 0){
      var worst = avoidance.sort(function(a,b){
        return b.consecutiveDebriefs - a.consecutiveDebriefs;
      })[0];
      if(worst.consecutiveDebriefs >= 2){
        var missions = Store.getAllMissions ? Store.getAllMissions() : Store.getMissions();
        var m = missions.find(function(x){ return x.name === worst.missionName; });
        return {
          type:             'behavior_pattern',
          missionName:      worst.missionName,
          camp:             m ? m.camp : 'Unknown',
          title:            'Break Avoidance Pattern: ' + worst.missionName,
          action:           'Open ' + worst.missionName + ' and complete one concrete step before anything else.',
          confidenceGain:   worst.confidenceGainAtStake || 3,
          whyItMatters:     'Priority 2 — Recurring avoidance. ' + worst.missionName +
                            ' appeared in "What Failed" for ' + worst.consecutiveDebriefs +
                            ' consecutive debriefs (' + worst.dates.join(', ') + '). ' +
                            'AETHER detected this by scanning debrief text — not guessing. ' +
                            'Every day avoided costs ' + (worst.confidenceGainAtStake || 3) + ' potential confidence points.',
          estimatedMinutes: 60,
          sourceLabel:      'Avoidance: ' + worst.consecutiveDebriefs + ' debriefs · ' + worst.dates.join(', ')
        };
      }
    }

    /* Check recurring deferrals */
    var deferrals = Store.getRecurringDeferrals ? Store.getRecurringDeferrals() : [];
    if(deferrals.length > 0){
      var top = deferrals[0];
      return {
        type:             'behavior_pattern',
        missionName:      top.name,
        camp:             'Unknown',
        title:            'Repeatedly Deferred: ' + top.name,
        action:           'Commit to ' + top.name + ' today. It has been deferred ' + top.count + ' times.',
        confidenceGain:   3,
        whyItMatters:     'Priority 2 — Recurring deferral. "' + top.name + '" has been deferred ' +
                          top.count + ' times. Deferral tracking shows this is becoming a pattern. ' +
                          'Each deferral delays campaign advancement.',
        estimatedMinutes: 60,
        sourceLabel:      'Deferred ' + top.count + ' times'
      };
    }

    return null;
  }

  /* ---- P5: Momentum — stalled mission with no active blocker ---- */
  function selectPriority5(){
    var missions = Store.getAllMissions ? Store.getAllMissions() : Store.getMissions();
    var live     = (Store.getLiveMissions ? Store.getLiveMissions() : []);
    if(live.length === 0) return null;

    /* Find live mission with stalledDays > 2 and not blocked */
    var stalled = live
      .filter(function(m){ return (m.stalledDays||0) > 2 && !m.blocked && m.pct < 100; })
      .sort(function(a,b){ return (b.stalledDays||0) - (a.stalledDays||0); })[0];

    if(!stalled) return null;

    return {
      type:             'momentum',
      missionName:      stalled.name,
      camp:             stalled.camp,
      title:            'Restart Momentum: ' + stalled.name,
      action:           'Do any one thing that moves ' + stalled.name + ' forward today.',
      confidenceGain:   stalled.confidenceGain || 2,
      whyItMatters:     'Priority 5 — Momentum preservation. ' + stalled.name +
                        ' has had no recorded activity for ' + stalled.stalledDays + ' days. ' +
                        'Missions that stall without a declared blocker tend to drift permanently.',
      estimatedMinutes: 45,
      sourceLabel:      stalled.name + ' · ' + stalled.stalledDays + ' days stalled'
    };
  }

  /* Find the next uncompleted live checkpoint across all live blueprints,
     ordered by blueprint creation date then checkpoint sortOrder. */
  function findNextLiveCheckpoint(){
    var liveBps  = Store.getLiveBlueprints ? Store.getLiveBlueprints() : [];
    var liveMissions = Store.getLiveMissions ? Store.getLiveMissions() : [];
    if(liveBps.length === 0) return null;

    for(var i=0; i<liveBps.length; i++){
      var bp = liveBps[i];
      var mission = liveMissions.find(function(m){ return m.key === bp.missionKey; }) || {};
      var cps = Store.getCheckpointsForBlueprint ? Store.getCheckpointsForBlueprint(bp.key) : [];
      var states = Store.getCheckpointStates ? Store.getCheckpointStates(bp.key) : {};

      /* Sort by sortOrder */
      cps = cps.slice().sort(function(a,b){ return (a.sortOrder||0)-(b.sortOrder||0); });

      for(var j=0; j<cps.length; j++){
        var cp = cps[j];
        if(!states[cp.id]){
          /* This checkpoint is not done — it's the next command */
          return {
            cpId:           cp.id,
            cpName:         cp.name,
            confidenceValue: cp.confidenceValue,
            blueprintKey:   bp.key,
            blueprintName:  bp.name,
            missionName:    mission.name || bp.missionName || 'Mission',
            camp:           mission.camp || 'Base Camp'
          };
        }
      }
    }
    return null;
  }

  /* ============================================================
     ACCEPT — Operator commits to the command
     ============================================================ */
  function accept(command){
    var rec = {
      dateKey:    todayKey(),
      dateLabel:  todayLabel(),
      status:     'accepted',
      command:    command,
      operatorNote: '',
      completedAt: null,
      failReason:  null,
      acceptedAt:  new Date().toISOString()
    };
    lsWrite(todayKey(), rec);
    return rec;
  }

  /* ============================================================
     MODIFY — Operator edits the command text before committing
     ============================================================ */
  function modify(command, operatorText){
    var modifiedCommand = Object.assign({}, command, {
      title:  operatorText || command.title,
      action: operatorText || command.action,
      type:   'manual'
    });
    var rec = {
      dateKey:    todayKey(),
      dateLabel:  todayLabel(),
      status:     'modified',
      command:    modifiedCommand,
      operatorNote: operatorText || '',
      completedAt: null,
      failReason:  null,
      acceptedAt:  new Date().toISOString()
    };
    lsWrite(todayKey(), rec);
    return rec;
  }

  /* ============================================================
     DEFER — Operator defers. Record it, return next best.
     ============================================================ */
  function defer(command){
    var rec = {
      dateKey:    todayKey(),
      dateLabel:  todayLabel(),
      status:     'deferred',
      command:    command,
      operatorNote: 'Deferred',
      completedAt: null,
      failReason:  null,
      acceptedAt:  new Date().toISOString()
    };
    lsWrite(todayKey() + '_deferred_' + Date.now(), rec);

    /* Log to defer tracking so recurring deferrals feed pattern detection */
    if(Store.logDefer){
      Store.logDefer(command.title, command.missionName, todayKey());
    }

    /* Compute next best after deferral */
    var intelCmd = Intel.computeTodaysCommand();
    if(intelCmd){
      intelCmd.estimatedMinutes = estimateMinutes(intelCmd.type, intelCmd.title);
    }
    return { deferred: rec, nextCommand: intelCmd };
  }

  /* ============================================================
     COMPLETE / FAIL — Evening debrief updates
     ============================================================ */
  function completeCommand(){
    var rec = lsRead(todayKey());
    if(!rec) return false;
    rec.status      = 'completed';
    rec.completedAt = new Date().toISOString();
    return lsWrite(todayKey(), rec);
  }

  function failCommand(reason){
    var rec = lsRead(todayKey());
    if(!rec) return false;
    rec.status     = 'failed';
    rec.failReason = reason || '';
    return lsWrite(todayKey(), rec);
  }

  /* ============================================================
     READ
     ============================================================ */
  function getRecord(dateKey){ return lsRead(dateKey); }
  function getTodayRecord(){   return lsRead(todayKey()); }
  function getTodayKey(){      return todayKey(); }
  function getTodayLabel(){    return todayLabel(); }

  /* Get last N daily command records, newest first */
  function getRecentRecords(n){
    var records = [];
    var d = new Date();
    for(var i=0; i<(n||7); i++){
      var y = d.getFullYear();
      var mo = String(d.getMonth()+1).padStart(2,'0');
      var day = String(d.getDate()).padStart(2,'0');
      var key = y + '-' + mo + '-' + day;
      var rec = lsRead(key);
      if(rec) records.push(rec);
      d.setDate(d.getDate()-1);
    }
    return records;
  }

  global.DailyCommand = {
    computeForToday:   computeForToday,
    accept:            accept,
    modify:            modify,
    defer:             defer,
    completeCommand:   completeCommand,
    failCommand:       failCommand,
    getRecord:         getRecord,
    getTodayRecord:    getTodayRecord,
    getTodayKey:       getTodayKey,
    getTodayLabel:     getTodayLabel,
    getRecentRecords:  getRecentRecords
  };

})(window);
