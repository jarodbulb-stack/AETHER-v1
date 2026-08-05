/* ============================================================
   AETHER — CAMPAIGN STORE
   Single source of truth for all campaign data across every page.

   Architecture notes:
   - Loaded as a plain <script src="campaignStore.js"></script> on
     every page, BEFORE that page's own inline <script>. This is a
     deliberate choice, not an oversight: AETHER pages are static
     files opened via file://, and ES module imports are unreliable
     over file:// in Chrome (CORS-like restrictions on local module
     resolution). A plain global object avoids that entirely.
   - Exposes one global: window.AetherStore.
   - Pages become views: they call AetherStore.getMissions(), etc.,
     and render whatever comes back. No page owns its own sample
     arrays anymore - if you find one, it's a bug, move it here.
   - SAMPLE vs LIVE is decided once, here, from the same
     'aether_system_mode' localStorage key Command Center writes.
   - LIVE mode currently always returns empty arrays/objects, since
     there is no Firebase yet (Phase 3). Each getter has a single
     TODO marking exactly where real-data fetching will plug in
     later, so that work has one obvious entry point per entity
     instead of being scattered across ten files again.
   - Purge Sample Data (Command Center) only needs to flip systemMode
     here. It does not need to know anything about what each page
     does with the data - that decoupling is the whole point of
     Phase 2.
   ============================================================ */

(function(global){
  'use strict';

  var SYSTEM_MODE_KEY = 'aether_system_mode';

  function getSystemMode(){
    try{ return localStorage.getItem(SYSTEM_MODE_KEY) || 'SAMPLE'; }
    catch(e){ return 'SAMPLE'; }
  }
  function setSystemMode(mode){
    try{ localStorage.setItem(SYSTEM_MODE_KEY, mode); }
    catch(e){ console.warn('AetherStore: could not persist systemMode.', e); }
  }
  function isLive(){ return getSystemMode() === 'LIVE'; }

  /* ============================================================
     SAMPLE DATA - migrated byte-for-byte from each page's former
     local seed arrays. Pure relocation, not a content change.
     ============================================================ */

  var sampleDomains = [
    {key:'health', name:'Health', icon:'heart', color:'var(--danger)', weight:15, pct:42, camp:'Camp II', trend:'up', spark:[20,24,28,31,35,38,42]},
    {key:'finance', name:'Finance', icon:'finance', color:'var(--success)', weight:15, pct:68, camp:'Camp III', trend:'strong', spark:[40,46,52,55,60,64,68]},
    {key:'relationships', name:'Relationships', icon:'heart2', color:'var(--purple)', weight:10, pct:35, camp:'Camp II', trend:'flat', spark:[33,34,33,35,34,36,35]},
    {key:'learning', name:'Learning', icon:'book', color:'var(--accent)', weight:10, pct:21, camp:'Camp I', trend:'up', spark:[8,10,12,15,17,19,21]},
    {key:'business', name:'Business', icon:'briefcase', color:'var(--warning)', weight:15, pct:12, camp:'Base Camp', trend:'down', spark:[24,22,19,17,15,13,12]},
    {key:'skills', name:'Skills & Mastery', icon:'star', color:'var(--gold)', weight:10, pct:28, camp:'Camp I', trend:'up', spark:[14,17,19,22,24,26,28]},
    {key:'character', name:'Character & Discipline', icon:'shield', color:'var(--teal)', weight:10, pct:31, camp:'Camp II', trend:'up', spark:[20,22,24,26,28,29,31]},
    {key:'spiritual', name:'Spiritual Life', icon:'sun', color:'var(--gold)', weight:5, pct:44, camp:'Camp II', trend:'flat', spark:[42,43,44,43,45,44,44]},
    {key:'purpose', name:'Purpose & Mission', icon:'target', color:'var(--purple)', weight:5, pct:38, camp:'Camp II', trend:'up', spark:[26,29,31,33,35,37,38]},
    {key:'environment', name:'Environment & Lifestyle', icon:'leaf', color:'var(--success)', weight:5, pct:18, camp:'Base Camp', trend:'down', spark:[28,26,24,22,20,19,18]}
  ];

  var sampleMissions = [
    { key:'aether', name:'AETHER', tagline:'Build AETHER System', icon:'mountain',
      objective:'Deploy production-ready AETHER system',
      domains:['Business','Learning','Skills & Mastery','Purpose & Mission'],
      pct:68, camp:'Camp III', nextCamp:'Camp IV', confidence:62, confidenceGain:12,
      weather:'Clear Skies', forecast:'6 Weeks', lastActivity:'2 Hours Ago', status:'advancing',
      milestones:[{name:'Finish Domain Pages', due:'Due Jun 20'},{name:'Complete Mission Engine', due:'Due Jun 25'},{name:'Connect Evidence Vault', due:'Due Jun 28'},{name:'Deploy Production Build', due:'Due Jul 05'}],
      evidence:[{name:'Screenshot', sub:'UI / Feature complete'},{name:'Git Commit', sub:'Mission engine updates'},{name:'Deployment URL', sub:'Staging environment'},{name:'Testing Log', sub:'Functionality tests'},{name:'Documentation', sub:'User guide draft'}],
      blocked:false, stalledDays:0, blocker:'', recoveryAction:'', impact:'' },
    { key:'financial', name:'Financial Recovery', tagline:'Eliminate Debt, Build Wealth', icon:'hexagon',
      objective:'Eliminate consumer debt and build a 3-month emergency reserve',
      domains:['Finance'],
      pct:45, camp:'Camp II', nextCamp:'Camp III', confidence:50, confidenceGain:10,
      weather:'Mixed Conditions', forecast:'10 Weeks', lastActivity:'1 Day Ago', status:'stable',
      milestones:[{name:'Pay off Card #2', due:'Due Jun 22'},{name:'Build 1-month buffer', due:'Due Jul 01'}],
      evidence:[{name:'Bank Statement', sub:'Monthly balance'},{name:'Budget Sheet', sub:'Spend tracking'}],
      blocked:false, stalledDays:0, blocker:'', recoveryAction:'', impact:'' },
    { key:'health', name:'Health Optimization', tagline:'Peak Physical Performance', icon:'heart',
      objective:'Build a sustainable training and sleep foundation',
      domains:['Health'],
      pct:73, camp:'Camp III', nextCamp:'Camp IV', confidence:70, confidenceGain:11,
      weather:'Clear Skies', forecast:'4 Weeks', lastActivity:'5 Hours Ago', status:'advancing',
      milestones:[{name:'Sleep Schedule Audit', due:'Due Jun 21'},{name:'4-week training block', due:'Due Jul 15'}],
      evidence:[{name:'Sleep Log', sub:'7-day tracking'},{name:'Training Log', sub:'Session records'}],
      blocked:false, stalledDays:0, blocker:'', recoveryAction:'', impact:'' },
    { key:'bible', name:'Bible Study System', tagline:'Deepen Faith, Build System', icon:'book',
      objective:'Establish a consistent daily study and reflection practice',
      domains:['Spiritual Life','Character & Discipline'],
      pct:58, camp:'Camp II', nextCamp:'Camp III', confidence:66, confidenceGain:8,
      weather:'Clear Skies', forecast:'3 Weeks', lastActivity:'1 Day Ago', status:'stable',
      milestones:[{name:'Complete Week 6 reading plan', due:'Due Jun 24'}],
      evidence:[{name:'Journal Entry', sub:'Daily reflection'},{name:'Reading Log', sub:'Plan progress'}],
      blocked:false, stalledDays:0, blocker:'', recoveryAction:'', impact:'' },
    { key:'hardware', name:'Hardware Expansion', tagline:'RLM Hardware Growth', icon:'rocket',
      objective:'Expand RLM Hardware Store inventory and POS coverage',
      domains:['Business','Finance'],
      pct:12, camp:'Base Camp', nextCamp:'Camp I', confidence:30, confidenceGain:9,
      weather:'Storm Front', forecast:'12 Weeks', lastActivity:'5 Days Ago', status:'warning',
      milestones:[{name:'Finalize supplier contracts', due:'Due Jul 10'}],
      evidence:[{name:'Invoice', sub:'Supplier purchase'},{name:'Stock Count', sub:'Inventory audit'}],
      blocked:true, stalledDays:5, blocker:'Capital allocation delay', recoveryAction:'Finalize budget plan', impact:'High' },
    { key:'discipline', name:'Discipline Engine', tagline:'Daily Systems, Less Friction', icon:'shield',
      objective:'Build repeatable morning and evening routines',
      domains:['Character & Discipline'],
      pct:31, camp:'Camp I', nextCamp:'Camp II', confidence:48, confidenceGain:7,
      weather:'Light Clouds', forecast:'8 Weeks', lastActivity:'2 Days Ago', status:'stable',
      milestones:[{name:'14-day morning streak', due:'Due Jun 30'}],
      evidence:[{name:'Routine Log', sub:'Daily check-in'}],
      blocked:false, stalledDays:0, blocker:'', recoveryAction:'', impact:'' },
    { key:'learning', name:'Skill Accelerator', tagline:'Compounding Knowledge', icon:'star',
      objective:'Complete core technical learning track for AETHER development',
      domains:['Learning','Skills & Mastery'],
      pct:21, camp:'Camp I', nextCamp:'Camp II', confidence:40, confidenceGain:8,
      weather:'Heavy Fog', forecast:'14 Weeks', lastActivity:'3 Days Ago', status:'stable',
      milestones:[{name:'Finish current course module', due:'Due Jun 27'}],
      evidence:[{name:'Certificate', sub:'Course completion'},{name:'Project Repo', sub:'Applied practice'}],
      blocked:false, stalledDays:0, blocker:'', recoveryAction:'', impact:'' },
    { key:'purpose', name:'Purpose Clarity', tagline:'Define the Mission', icon:'target',
      objective:'Clarify long-term purpose and mission statement for the next 5 years',
      domains:['Purpose & Mission'],
      pct:38, camp:'Camp II', nextCamp:'Camp III', confidence:55, confidenceGain:6,
      weather:'Light Clouds', forecast:'6 Weeks', lastActivity:'4 Days Ago', status:'stable',
      milestones:[{name:'Draft 5-year vision document', due:'Due Jul 03'}],
      evidence:[{name:'Vision Document', sub:'Written draft'}],
      blocked:false, stalledDays:0, blocker:'', recoveryAction:'', impact:'' },
    { key:'relationships', name:'Relationship Investment', tagline:'Deepen Key Bonds', icon:'heart',
      objective:'Increase quality time and consistency with family',
      domains:['Relationships'],
      pct:35, camp:'Camp II', nextCamp:'Camp III', confidence:52, confidenceGain:5,
      weather:'Light Clouds', forecast:'Ongoing', lastActivity:'1 Day Ago', status:'stable',
      milestones:[{name:'Weekly family night, 4-week streak', due:'Due Jul 12'}],
      evidence:[{name:'Photo Evidence', sub:'Shared activity'}],
      blocked:true, stalledDays:3, blocker:'Inconsistent scheduling', recoveryAction:'Fix recurring calendar slot', impact:'Medium' },
    { key:'environment', name:'Environment Reset', tagline:'Optimize Living Space', icon:'leaf',
      objective:'Declutter and organize home and work environment',
      domains:['Environment & Lifestyle'],
      pct:18, camp:'Base Camp', nextCamp:'Camp I', confidence:34, confidenceGain:4,
      weather:'Windy', forecast:'5 Weeks', lastActivity:'6 Days Ago', status:'warning',
      milestones:[{name:'Clear and organize workspace', due:'Due Jun 26'}],
      evidence:[{name:'Before/After Photos', sub:'Space comparison'}],
      blocked:false, stalledDays:0, blocker:'', recoveryAction:'', impact:'' }
  ];

  var sampleBlueprints = [
    { key:'aether', missionName:'AETHER', name:'AETHER System Blueprint', icon:'mountain',
      objective:'Deploy a production-ready AETHER system across all core pages',
      currentPhase:'Phase 2: Domain Pages', nextMilestone:'Finish Domain Pages',
      hazard:'Technical debt slowing development', recovery:'Reduce scope, ship core pages first, refine later',
      evidence:'Screenshot, Git Commit, Deployment URL',
      pct:68, confidence:62, status:'advancing' },
    { key:'financial', missionName:'Financial Recovery', name:'Financial Recovery Blueprint', icon:'hexagon',
      objective:'Eliminate consumer debt and build a 3-month emergency reserve',
      currentPhase:'Phase 1: Debt Paydown', nextMilestone:'Pay off Card #2',
      hazard:'Impulse spending under stress', recovery:'Automate transfers before discretionary spend hits the account',
      evidence:'Bank Statement, Budget Sheet',
      pct:45, confidence:50, status:'stable' },
    { key:'health', missionName:'Health Optimization', name:'Peak Performance Blueprint', icon:'heart',
      objective:'Reach Camp III Health: stable sleep, consistent training, target body composition',
      currentPhase:'Phase 2: Consistency', nextMilestone:'Sleep Schedule Audit',
      hazard:'Late nights breaking the sleep window', recovery:'Restart protocol: reset bedtime, drop intensity for 3 days',
      evidence:'Sleep Logs, Workout Logs, Body Metrics',
      pct:73, confidence:70, status:'advancing' },
    { key:'bible', missionName:'Bible Study System', name:'Faith Foundation Blueprint', icon:'book',
      objective:'Establish a consistent daily study and reflection practice',
      currentPhase:'Phase 2: Habit Lock-In', nextMilestone:'Complete Week 6 reading plan',
      hazard:'Missed mornings break the streak', recovery:'Shorten session to 10 minutes rather than skip entirely',
      evidence:'Journal Entry, Reading Log',
      pct:58, confidence:66, status:'stable' },
    { key:'hardware', missionName:'Hardware Expansion', name:'Hardware Expansion Blueprint', icon:'rocket',
      objective:'Expand RLM Hardware Store inventory and POS coverage',
      currentPhase:'Phase 1: Capital Planning', nextMilestone:'Finalize supplier contracts',
      hazard:'Capital allocation delay', recovery:'Finalize budget plan, re-sequence supplier commitments',
      evidence:'Invoice, Supplier Agreement, Stock Count',
      pct:12, confidence:30, status:'critical' },
    { key:'discipline', missionName:'Discipline Engine', name:'Daily Systems Blueprint', icon:'shield',
      objective:'Build repeatable morning and evening routines that hold under pressure',
      currentPhase:'Phase 1: Foundation', nextMilestone:'14-day morning streak',
      hazard:'Inconsistency when travel or disruption hits', recovery:'Define a minimum-viable routine for disrupted days',
      evidence:'Routine Log',
      pct:31, confidence:48, status:'stable' },
    { key:'learning', missionName:'Skill Accelerator', name:'Skill Accelerator Blueprint', icon:'star',
      objective:'Complete core technical learning track for AETHER development',
      currentPhase:'Phase 1: Core Curriculum', nextMilestone:'Finish current course module',
      hazard:'Heavy fog: unclear what to study next', recovery:'Lock a fixed weekly curriculum, stop browsing for "better" resources',
      evidence:'Certificate, Project Repo',
      pct:21, confidence:40, status:'stable' },
    { key:'purpose', missionName:'Purpose Clarity', name:'Purpose Clarity Blueprint', icon:'target',
      objective:'Clarify long-term purpose and mission statement for the next 5 years',
      currentPhase:'Phase 1: Reflection', nextMilestone:'Draft 5-year vision document',
      hazard:'Vague language that fails to drive decisions', recovery:'Force specificity: name concrete outcomes, not feelings',
      evidence:'Vision Document',
      pct:38, confidence:55, status:'stable' },
    { key:'relationships', missionName:'Relationship Investment', name:'Relationship Investment Blueprint', icon:'heart',
      objective:'Increase quality time and consistency with family',
      currentPhase:'Phase 1: Scheduling', nextMilestone:'Weekly family night, 4-week streak',
      hazard:'Inconsistent scheduling', recovery:'Fix a recurring calendar slot that nothing else can claim',
      evidence:'Photo Evidence',
      pct:35, confidence:52, status:'warning' },
    { key:'environment', missionName:'Environment Reset', name:'Environment Reset Blueprint', icon:'leaf',
      objective:'Declutter and organize home and work environment',
      currentPhase:'Phase 1: Clearing', nextMilestone:'Clear and organize workspace',
      hazard:'Windy conditions: easy to lose momentum mid-task', recovery:'Timebox to 25-minute sessions, stop and resume rather than abandon',
      evidence:'Before/After Photos',
      pct:18, confidence:34, status:'warning' }
  ];

  var sampleCheckpoints = [
    { id:'cp1', name:'Command Deck', evidenceRequired:'Deployment URL, Screenshot', confidenceValue:3, defaultDone:true, defaultVerified:true, completedDate:'Jun 19' },
    { id:'cp2', name:'Life Advancement', evidenceRequired:'Deployment URL, Screenshot', confidenceValue:3, defaultDone:true, defaultVerified:true, completedDate:'Jun 19' },
    { id:'cp3', name:'Missions', evidenceRequired:'Deployment URL, Screenshot', confidenceValue:2, defaultDone:true, defaultVerified:true, completedDate:'Jun 19' },
    { id:'cp4', name:'Blueprints', evidenceRequired:'Deployment URL, Screenshot', confidenceValue:2, defaultDone:true, defaultVerified:false, completedDate:'Jun 20' },
    { id:'cp5', name:'Blueprint Detail Page', evidenceRequired:'Deployment URL, Git Commit', confidenceValue:3, defaultDone:false, defaultVerified:false, completedDate:null },
    { id:'cp6', name:'Blockers', evidenceRequired:'Deployment URL, Screenshot', confidenceValue:2, defaultDone:false, defaultVerified:false, completedDate:null },
    { id:'cp7', name:'Evidence Vault', evidenceRequired:'Deployment URL, Screenshot', confidenceValue:2, defaultDone:false, defaultVerified:false, completedDate:null },
    { id:'cp8', name:'Timeline', evidenceRequired:'Deployment URL, Screenshot', confidenceValue:2, defaultDone:false, defaultVerified:false, completedDate:null },
    { id:'cp9', name:'Debrief', evidenceRequired:'Deployment URL, Screenshot', confidenceValue:1, defaultDone:false, defaultVerified:false, completedDate:null },
    { id:'cp10', name:'Command Center', evidenceRequired:'Deployment URL, Git Commit', confidenceValue:2, defaultDone:false, defaultVerified:false, completedDate:null }
  ];

  var sampleBlockers = [
    { key:'evidence-vault-arch', name:'Evidence Vault architecture undefined',
      severity:'High', status:'open',
      affectedMission:'AETHER', affectedBlueprint:'Execution Layer',
      owner:'Rod Entera', dateDiscovered:'Jun 21',
      recoveryPlan:'Define vault structure: storage model, evidence types, linkage to checkpoints',
      daysOpen:0 },
    { key:'hardware-capital', name:'Capital allocation delay',
      severity:'High', status:'open',
      affectedMission:'Hardware Expansion', affectedBlueprint:'Hardware Expansion Blueprint',
      owner:'Rod Entera', dateDiscovered:'Jun 16',
      recoveryPlan:'Finalize budget plan, re-sequence supplier commitments',
      daysOpen:5 },
    { key:'relationship-schedule', name:'Inconsistent scheduling',
      severity:'Medium', status:'progress',
      affectedMission:'Relationship Investment', affectedBlueprint:'Relationship Investment Blueprint',
      owner:'Rod Entera', dateDiscovered:'Jun 18',
      recoveryPlan:'Fix a recurring calendar slot that nothing else can claim',
      daysOpen:3 },
    { key:'blockers-page-missing', name:'No system to manage blockers',
      severity:'Medium', status:'resolved',
      affectedMission:'AETHER', affectedBlueprint:'Execution Layer',
      owner:'Rod Entera', dateDiscovered:'Jun 21',
      recoveryPlan:'Build the Blockers page itself, resolved by this page going live',
      daysOpen:0 },
    { key:'database-schema', name:'Production database schema not defined',
      severity:'Low', status:'open',
      affectedMission:'AETHER', affectedBlueprint:'AETHER System Blueprint',
      owner:'Rod Entera', dateDiscovered:'Jun 21',
      recoveryPlan:'Deferred to Phase 2 (Firebase wiring), not required for Phase 1 UI build',
      daysOpen:0 }
  ];

  var sampleEvidence = [
    { id:'ev1', name:'Command Deck Deployed', type:'Deployment URL', mission:'AETHER', blueprint:'Execution Layer', checkpoint:'Command Deck', dateSubmitted:'Jun 19', confidenceValue:3, notes:'Stat strip, Today Command, Domain Status Board all confirmed working.', attachment:'dashboard.html', defaultStatus:'verified' },
    { id:'ev2', name:'Life Advancement Deployed', type:'Deployment URL', mission:'AETHER', blueprint:'Execution Layer', checkpoint:'Life Advancement', dateSubmitted:'Jun 19', confidenceValue:3, notes:'The Great Mountain overlay system confirmed rendering with all 7 camps.', attachment:'life-advancement.html', defaultStatus:'verified' },
    { id:'ev3', name:'Missions Command Screenshot', type:'Screenshot', mission:'AETHER', blueprint:'Execution Layer', checkpoint:'Missions', dateSubmitted:'Jun 19', confidenceValue:2, notes:'Circular ring cards and Selected Mission Intelligence confirmed in Chrome.', attachment:'missions_command.png', defaultStatus:'verified' },
    { id:'ev4', name:'Blueprints Board Deployed', type:'Deployment URL', mission:'AETHER', blueprint:'Execution Layer', checkpoint:'Blueprints', dateSubmitted:'Jun 20', confidenceValue:2, notes:'Submitted but not yet visually confirmed in browser.', attachment:'blueprints.html', defaultStatus:'pending' },
    { id:'ev5', name:'Blueprint Detail Page Git Commit', type:'Git Commit', mission:'AETHER', blueprint:'Execution Layer', checkpoint:'Blueprint Detail Page', dateSubmitted:'Jun 21', confidenceValue:3, notes:'Checkpoint tracker with localStorage persistence built and runtime-tested.', attachment:'blueprint-detail.html', defaultStatus:'pending' },
    { id:'ev6', name:'Blockers Page Deployment URL', type:'Deployment URL', mission:'AETHER', blueprint:'Execution Layer', checkpoint:'Blockers', dateSubmitted:'Jun 21', confidenceValue:2, notes:'Blocker board and severity breakdown built, grounded in real mission blocker data.', attachment:'problems-blockers.html', defaultStatus:'pending' },
    { id:'ev7', name:'Evidence Vault Self-Reference', type:'Screenshot', mission:'AETHER', blueprint:'Execution Layer', checkpoint:'Evidence Vault', dateSubmitted:'Jun 21', confidenceValue:2, notes:'This page itself, the moment it is confirmed working in Chrome.', attachment:'evidence-vault.html', defaultStatus:'pending' }
  ];

  var sampleTimelineEvents = [
    { day:'Today', type:'verified', name:'Blueprints Board Deployed', sub:'AETHER, Blueprints checkpoint', time:'Just now', delta:'+2' },
    { day:'Today', type:'checkpoint', name:'Evidence Vault', sub:'AETHER System Blueprint, Camp III', time:'10 min ago', delta:'' },
    { day:'Today', type:'checkpoint', name:'Blockers', sub:'AETHER System Blueprint, Camp III', time:'34 min ago', delta:'' },
    { day:'Today', type:'resolved', name:'No system to manage blockers', sub:'Resolved by Blockers page going live', time:'34 min ago', delta:'' },
    { day:'Today', type:'blocker', name:'Evidence Vault architecture undefined', sub:'AETHER, Execution Layer, High severity', time:'1 hr ago', delta:'' },
    { day:'Today', type:'checkpoint', name:'Blueprint Detail Page', sub:'AETHER System Blueprint, Camp III', time:'1 hr ago', delta:'' },
    { day:'Today', type:'evidence', name:'Blueprint Detail Page Git Commit submitted', sub:'AETHER, Execution Layer', time:'1 hr ago', delta:'' },
    { day:'Yesterday', type:'evidence', name:'Blueprints Board Deployment URL submitted', sub:'AETHER, Execution Layer', time:'11:14 AM', delta:'' },
    { day:'Yesterday', type:'checkpoint', name:'Blueprints', sub:'AETHER System Blueprint, Camp III', time:'11:14 AM', delta:'' },
    { day:'Jun 19', type:'verified', name:'Missions Command Screenshot', sub:'AETHER, Missions checkpoint', time:'4:16 PM', delta:'+2' },
    { day:'Jun 19', type:'checkpoint', name:'Missions', sub:'AETHER System Blueprint, Camp III', time:'4:16 PM', delta:'' },
    { day:'Jun 19', type:'verified', name:'Life Advancement Deployed', sub:'AETHER, Life Advancement checkpoint', time:'8:07 AM', delta:'+3' },
    { day:'Jun 19', type:'checkpoint', name:'Life Advancement', sub:'AETHER System Blueprint, Camp III', time:'8:07 AM', delta:'' },
    { day:'Jun 19', type:'verified', name:'Command Deck Deployed', sub:'AETHER, Command Deck checkpoint', time:'7:28 AM', delta:'+3' },
    { day:'Jun 19', type:'checkpoint', name:'Command Deck', sub:'AETHER System Blueprint, Camp III', time:'7:28 AM', delta:'' },
    { day:'Jun 19', type:'mission', name:'AETHER mission and blueprint created', sub:'Execution Layer blueprint established', time:'6:04 AM', delta:'' }
  ];

  var sampleTodaysEvents = [
    { type:'checkpoint', name:'Blueprint Detail Page Verified', time:'1 hr ago' },
    { type:'checkpoint', name:'Blockers Page Verified', time:'34 min ago' },
    { type:'resolved', name:'Blocker resolved: No system to manage blockers', time:'34 min ago' },
    { type:'checkpoint', name:'Evidence Vault Verified', time:'10 min ago' },
    { type:'verified', name:'Blueprints Board evidence verified, plus 2 confidence', time:'Just now' },
    { type:'blocker', name:'New blocker: Evidence Vault architecture undefined', time:'1 hr ago' },
    { type:'evidence', name:'Blueprint Detail Page Git Commit submitted', time:'1 hr ago' }
  ];

  /* Five seeded debriefs, deliberately reflecting the real build
     pattern visible across this campaign: strong follow-through on
     whichever page was actively being built, paired with a real
     recurring gap on Hardware Expansion, which has sat at 12%
     progress with an open High-severity blocker since it was first
     seeded and has not been touched since. This is not invented
     psychology; it is an honest record of what the actual mission
     data already shows. Must be removed when systemMode = LIVE. */
  var samplePastDebriefs = [
    { day:'17', month:'JUN', date:'Jun 17',
      worked:'Finished Command Deck.', failed:'Got distracted by UI redesign ideas instead of moving to the next page.',
      changed:'Decided to lock pages once shipped instead of re-polishing them.', notes:'',
      evidenceCount:1, blockersCount:0, confidenceChange:3 },
    { day:'18', month:'JUN', date:'Jun 18',
      worked:'Finished Life Advancement page.', failed:'Worked on visual ideas for the mountain instead of starting Blockers.',
      changed:'Agreed to defer mountain artwork until the execution layer is done.', notes:'',
      evidenceCount:1, blockersCount:0, confidenceChange:3 },
    { day:'19', month:'JUN', date:'Jun 19',
      worked:'Finished Missions page.', failed:'Avoided Hardware Expansion again, still at 12% with the capital allocation blocker open.',
      changed:'', notes:'',
      evidenceCount:1, blockersCount:0, confidenceChange:2 },
    { day:'20', month:'JUN', date:'Jun 20',
      worked:'Built Blueprint Detail page.', failed:'Still avoided Hardware Expansion. Capital allocation blocker now 4 days old.',
      changed:'', notes:'',
      evidenceCount:0, blockersCount:0, confidenceChange:0 },
    { day:'21', month:'JUN', date:'Jun 21',
      worked:'Finished Evidence Vault.', failed:'Avoided Hardware Expansion for the third consecutive debrief. Blocker now 5 days old.',
      changed:'', notes:'',
      evidenceCount:1, blockersCount:1, confidenceChange:2 }
  ];

  var sampleMilestones = [
    { name:'Command Deck Verified', sub:'Situation room confirmed working in Chrome', date:'Jun 19' },
    { name:'Life Advancement Verified', sub:'The Great Mountain overlay system confirmed', date:'Jun 19' },
    { name:'Missions Verified', sub:'Mission Command Board with circular rings confirmed', date:'Jun 19' },
    { name:'Blueprints Verified', sub:'Blueprint Command Board deployed', date:'Jun 20' },
    { name:'Blueprint Detail Page Verified', sub:'First true execution-layer page, checkpoint loop proven', date:'Jun 21' },
    { name:'Problems / Blockers Verified', sub:'Blocker board grounded in real mission data', date:'Jun 21' },
    { name:'Evidence Vault Verified', sub:'Confidence engine live, verify/reject loop proven', date:'Jun 21' }
  ];

  var sampleCampData = [
    { camp:'Base Camp', pct:0, status:'reached', dateReached:'Jun 18' },
    { camp:'Camp I', pct:15, status:'reached', dateReached:'Jun 19' },
    { camp:'Camp II', pct:28, status:'reached', dateReached:'Jun 19' },
    { camp:'Camp III', pct:50, status:'current', dateReached:'In progress' },
    { camp:'Camp IV', pct:75, status:'pending', dateReached:'-' }
  ];

  var sampleElevationGains = [
    {name:'Completed Python for ML', sub:'Learning · Camp I → Camp II', date:'Jun 16', delta:'+3%'},
    {name:'Completed 15K training run', sub:'Health · Camp I → Camp II', date:'Jun 15', delta:'+2%'},
    {name:'Investment portfolio rebalanced', sub:'Finance · Camp II Progress', date:'Jun 14', delta:'+2%'},
    {name:'Weekly family time maintained', sub:'Relationships · Consistency Win', date:'Jun 13', delta:'+1%'},
    {name:'Morning routine 14-day streak', sub:'Character · Discipline Building', date:'Jun 12', delta:'+1%'}
  ];

  /* ---------- Command Deck-specific sample data ----------
     Command Deck's domain board uses a different field shape than
     Life Advancement's domainDefs (glyph icons, weather labels,
     no weight/spark), so it gets its own getter rather than being
     force-unified with getDomains(). Same for threats/opportunities/
     victories/terrains, each of which is genuinely distinct content
     specific to this page, not a duplicate of anything else. */
  var sampleDashboardDomains = [
    {name:'Health', icon:'❤', color:'var(--danger)', pct:42, trend:'up', camp:'Camp II', sub:'Build Foundation', weather:'light_clouds', wlabel:'Light Clouds'},
    {name:'Finance', icon:'$', color:'var(--success)', pct:68, trend:'strong', camp:'Camp III', sub:'Build Wealth', weather:'clear', wlabel:'Clear Skies'},
    {name:'Relationships', icon:'♥', color:'var(--purple)', pct:35, trend:'flat', camp:'Camp II', sub:'Deepen Bonds', weather:'light_clouds', wlabel:'Light Clouds'},
    {name:'Learning', icon:'▤', color:'var(--accent)', pct:21, trend:'up', camp:'Camp I', sub:'Build Knowledge', weather:'fog', wlabel:'Heavy Fog'},
    {name:'Business', icon:'◆', color:'var(--warning)', pct:12, trend:'down', camp:'Base Camp', sub:'Foundation', weather:'storm', wlabel:'Storm Front'},
    {name:'Skills & Mastery', icon:'★', color:'var(--gold)', pct:28, trend:'up', camp:'Camp I', sub:'Develop Skills', weather:'light_clouds', wlabel:'Light Clouds'},
    {name:'Character', icon:'◇', color:'var(--teal)', pct:31, trend:'up', camp:'Camp II', sub:'Build Discipline', weather:'clear', wlabel:'Clear Skies'},
    {name:'Spiritual', icon:'☀', color:'var(--gold)', pct:44, trend:'flat', camp:'Camp II', sub:'Inner Growth', weather:'light_clouds', wlabel:'Light Clouds'},
    {name:'Purpose & Mission', icon:'◎', color:'var(--purple)', pct:38, trend:'up', camp:'Camp II', sub:'Clarify Purpose', weather:'light_clouds', wlabel:'Light Clouds'},
    {name:'Environment', icon:'❖', color:'var(--success)', pct:18, trend:'down', camp:'Base Camp', sub:'Optimize Space', weather:'windy', wlabel:'Windy'}
  ];

  var sampleThreats = [
    {name:'Business', sub:'No progress for 4 days'},
    {name:'AETHER', sub:'Technical debt slowing development'},
    {name:'Health', sub:'Sleep schedule inconsistency'}
  ];

  var sampleOpportunities = [
    {name:'Peak Performance', gain:'+5 Confidence'},
    {name:'Learning Momentum', gain:'+4 Confidence'},
    {name:'Financial Recovery', gain:'+6 Confidence'}
  ];

  var sampleVictories = [
    {name:'Completed 15K training run', sub:'Health · Camp I'},
    {name:'Investment portfolio rebalanced', sub:'Finance · Camp II'},
    {name:'Customer interview #5 completed', sub:'Business · Base Camp'},
    {name:'Python for ML course completed', sub:'Learning · Camp I'},
    {name:'Weekly family time maintained', sub:'Relationships · Consistency Win'}
  ];

  var sampleTerrains = [
    {name:'Health', cls:'health', img:'mountain-advancement.png', camp:'Camp II', pct:'42%', trend:'up', weather:'Light Clouds', wicon:'light_clouds'},
    {name:'Finance', cls:'finance', img:'mountain-campaign.png', camp:'Camp III', pct:'68%', trend:'up', weather:'Clear Skies', wicon:'clear'},
    {name:'Learning', cls:'learning', img:'mountain-advancement.png', camp:'Camp I', pct:'21%', trend:'up', weather:'Heavy Fog', wicon:'fog'},
    {name:'Business', cls:'business', img:'mountain-campaign.png', camp:'Base Camp', pct:'12%', trend:'down', weather:'Storm Front', wicon:'storm'}
  ];

  var sampleConfidenceHistory = [
    {day:'Mon', val:71}, {day:'Tue', val:68}, {day:'Wed', val:70},
    {day:'Thu', val:65}, {day:'Fri', val:63}, {day:'Sat', val:64}, {day:'Sun', val:62}
  ];

  /* ============================================================
     PUBLIC READ API - SAMPLE mode returns migrated arrays;
     LIVE mode returns empty until Phase 3 wires a real source.
     ============================================================ */

  function getDomains(){
    if(isLive()){
      /* LIVE mode: real domain progress using a "banked half + live half"
         model instead of a raw average or an arbitrary points threshold.

         Once a domain has ever had ALL of its current missions complete
         at the same time, it shows 100% (fully summited). The moment a
         new, unfinished mission is added to that domain, it drops to a
         50% floor — never further — because that 50% represents real,
         already-earned accomplishment that doesn't get erased just
         because new work started. The other 50% is driven live by the
         average progress of whatever's still in motion in that domain,
         so finishing that new mission climbs back to 100%, and the
         cycle repeats cleanly every time new work is added afterward.

         Before a domain has ever completed anything at all, there's no
         "banked" half yet — it's just the honest live average of
         whatever's in progress, starting from 0. */
      var liveMissionsForDomains = (typeof getLiveMissions === 'function') ? getLiveMissions() : [];
      return sampleDomains.map(function(d){
        var tagged    = liveMissionsForDomains.filter(function(m){ return (m.domains||[]).indexOf(d.name) !== -1; });
        var completed = tagged.filter(function(m){ return m.pct >= 100; });
        var inProgress = tagged.filter(function(m){ return m.pct < 100; });

        var pct;
        if(tagged.length === 0){
          pct = 0; /* nothing tagged here yet */
        } else if(inProgress.length === 0){
          pct = 100; /* everything currently tracked here is finished */
        } else if(completed.length === 0){
          /* nothing ever banked yet — pure live average from 0 */
          pct = Math.round(inProgress.reduce(function(s,m){ return s + m.pct; }, 0) / inProgress.length);
        } else {
          /* banked 50% floor (already earned, can't be lost) + the
             live average of what's still in progress filling the
             other half */
          var liveAvg = inProgress.reduce(function(s,m){ return s + m.pct; }, 0) / inProgress.length;
          pct = 50 + Math.round(liveAvg / 2);
        }

        var camp = pct >= 100 ? 'Summit' : pct >= 90 ? 'Camp V' : pct >= 75 ? 'Camp IV' : pct >= 50 ? 'Camp III' : pct >= 28 ? 'Camp II' : pct >= 15 ? 'Camp I' : 'Base Camp';
        return {
          key: d.key, name: d.name, icon: d.icon, color: d.color, weight: d.weight,
          pct: pct, camp: camp, trend: 'flat', spark: [0,0,0,0,0,0,0],
          missionsCompleted: completed.length,
          missionsInProgress: inProgress.length
        };
      });
    }
    return sampleDomains;
  }
  function getMissions(){
    /* LIVE mode: return the operator's real missions (not empty).
       SAMPLE mode: sample + any real missions already created.
       This keeps every page consistent whether it calls getMissions()
       or getAllMissions(). */
    var live = (typeof getLiveMissions === 'function') ? getLiveMissions() : [];
    if(isLive()){ return live; }
    return sampleMissions.concat(live);
  }
  function getBlueprints(){
    var live = (typeof getLiveBlueprints === 'function') ? getLiveBlueprints() : [];
    if(isLive()){ return live; }
    return sampleBlueprints.concat(live);
  }
  function getCheckpoints(){
    if(isLive()){ return (typeof getLiveCheckpoints==='function') ? getLiveCheckpoints() : []; }
    return sampleCheckpoints;
  }
  function getBlockers(){
    var live = (typeof getLiveBlockers === 'function') ? getLiveBlockers() : [];
    if(isLive()){ return live; }
    return sampleBlockers.concat(live);
  }
  var LIVE_TIMELINE_KEY = 'aether_live_timeline';

  function getLiveTimelineEvents(){ return lsGet(LIVE_TIMELINE_KEY); }

  /* Records a real event as it happens (checkpoint verified, blocker
     resolved, debrief completed). Stores a raw ISO timestamp only —
     day/time labels are computed fresh on every read so "Today" /
     "Yesterday" stay accurate no matter when the Timeline is viewed,
     rather than freezing a stale label at write-time. */
  function addTimelineEvent(evt){
    var events = getLiveTimelineEvents();
    events.unshift({
      id:    genId('tl'),
      iso:   new Date().toISOString(),
      type:  evt.type || 'checkpoint',
      name:  evt.name || '',
      sub:   evt.sub || '',
      delta: evt.delta || ''
    });
    lsSet(LIVE_TIMELINE_KEY, events);
  }

  function relativeDayLabel(iso){
    var d = new Date(iso), now = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var yestD  = new Date(todayD); yestD.setDate(yestD.getDate() - 1);
    var eventD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if(eventD.getTime() === todayD.getTime()) return 'Today';
    if(eventD.getTime() === yestD.getTime()) return 'Yesterday';
    return months[d.getMonth()] + ' ' + d.getDate();
  }

  function relativeTimeLabel(iso){
    var d = new Date(iso), now = new Date();
    if(relativeDayLabel(iso) === 'Today'){
      var mins = Math.floor((now - d) / 60000);
      if(mins < 1) return 'Just now';
      if(mins < 60) return mins + ' min ago';
      return Math.floor(mins / 60) + ' hr ago';
    }
    var h = d.getHours(), m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if(h === 0) h = 12;
    return h + ':' + String(m).padStart(2,'0') + ' ' + ampm;
  }

  var LIVE_EVIDENCE_KEY = 'aether_live_evidence';

  function getLiveEvidence(){ return lsGet(LIVE_EVIDENCE_KEY); }

  function getEvidence(){
    var live = getLiveEvidence();
    if(isLive()){ return live; }
    return sampleEvidence.concat(live);
  }

  /* Caller supplies: name, type, missionKey, missionName, blueprintKey,
     blueprintName, checkpointId, checkpointName, confidenceValue, notes,
     attachment (a URL or text reference — this is an offline app, so
     evidence is a link/note, not a file upload), status ('pending'|'verified') */
  function saveEvidence(data){
    var list = getLiveEvidence();
    var now = todayLabel();
    var e = {
      id:              genId('ev'),
      name:            (data.name || '').trim(),
      type:            data.type || 'Document',
      mission:         data.missionName || '',
      missionKey:      data.missionKey || '',
      blueprint:       data.blueprintName || '',
      blueprintKey:    data.blueprintKey || '',
      checkpoint:      data.checkpointName || '',
      checkpointId:    data.checkpointId || '',
      dateSubmitted:   now,
      confidenceValue: parseInt(data.confidenceValue, 10) || 2,
      notes:           (data.notes || '').trim(),
      attachment:      (data.attachment || '').trim(),
      defaultStatus:   data.status === 'verified' ? 'verified' : 'pending',
      isLive:          true,
      createdAt:       now
    };
    list.push(e);
    lsSet(LIVE_EVIDENCE_KEY, list);
    if(isLive()){
      addTimelineEvent({
        type: e.defaultStatus === 'verified' ? 'verified' : 'evidence',
        name: e.name + (e.defaultStatus === 'verified' ? ' verified' : ' submitted'),
        sub:  e.blueprint || e.mission || '',
        delta: e.defaultStatus === 'verified' ? '+' + e.confidenceValue : ''
      });
    }
    return e;
  }

  function deleteEvidence(id){
    var list = getLiveEvidence().filter(function(e){ return e.id !== id; });
    lsSet(LIVE_EVIDENCE_KEY, list);
    return true;
  }

  /* Updates a real evidence record's verified/pending status. Unlike the
     old page-local overlay, this actually persists and is read by the
     Commander Confidence engine everywhere, not just on one page. */
  function updateEvidenceStatus(id, status){
    var list = getLiveEvidence();
    var idx = list.findIndex(function(e){ return e.id === id; });
    if(idx === -1) return false;
    var wasVerified = list[idx].defaultStatus === 'verified';
    list[idx].defaultStatus = status;
    lsSet(LIVE_EVIDENCE_KEY, list);
    if(isLive() && status === 'verified' && !wasVerified){
      addTimelineEvent({
        type: 'verified',
        name: list[idx].name + ' verified',
        sub:  list[idx].blueprint || list[idx].mission || '',
        delta: '+' + list[idx].confidenceValue
      });
    }
    return true;
  }
  function getTimelineEvents(){
    if(isLive()){
      return getLiveTimelineEvents().map(function(e){
        return { day: relativeDayLabel(e.iso), type: e.type, name: e.name, sub: e.sub, time: relativeTimeLabel(e.iso), delta: e.delta };
      });
    }
    return sampleTimelineEvents;
  }
  function getTodaysEvents(){
    if(isLive()){
      return getLiveTimelineEvents()
        .filter(function(e){ return relativeDayLabel(e.iso) === 'Today'; })
        .map(function(e){ return { type: e.type, name: e.name, time: relativeTimeLabel(e.iso) }; });
    }
    return sampleTodaysEvents;
  }
  function getPastDebriefs(){
    var live = (typeof getLiveDebriefs === 'function') ? getLiveDebriefs() : [];
    if(isLive()){ return live; }
    return samplePastDebriefs.concat(live);
  }
  function getMilestones(){
    if(isLive()){ return []; }
    return sampleMilestones;
  }
  function getCampData(){
    if(isLive()){ return []; }
    return sampleCampData;
  }
  function getElevationGains(){
    if(isLive()){ return []; }
    return sampleElevationGains;
  }
  function getDashboardDomains(){
    if(isLive()){ return []; }
    return sampleDashboardDomains;
  }
  function getThreats(){
    if(isLive()){ return []; }
    return sampleThreats;
  }
  function getOpportunities(){
    if(isLive()){ return []; }
    return sampleOpportunities;
  }
  function getVictories(){
    if(isLive()){ return []; }
    return sampleVictories;
  }
  function getTerrains(){
    if(isLive()){ return []; }
    return sampleTerrains;
  }
  function getConfidenceHistory(){
    if(isLive()){ return []; }
    return sampleConfidenceHistory;
  }

  function getCampaignMeta(){
    return {
      mode: getSystemMode(),
      status: 'Active',
      createdAt: 'Jun 18, 2026',
      lastActivity: 'Jun 21, 2026'
    };
  }

  function purgeSampleData(){
    setSystemMode('LIVE');
  }

  /* ============================================================
     PHASE 4A — LIVE DATA READ/WRITE API
     All real operator data persists to localStorage under
     'aether_live_*' keys. Completely separate from sample arrays.
     Works in both SAMPLE and LIVE mode — LIVE mode uses ONLY these.
     SAMPLE mode shows sample data PLUS any real entries the operator
     has already created (so you can test creation before purging).
     ============================================================ */

  var LIVE_MISSIONS_KEY     = 'aether_live_missions';
  var LIVE_BLUEPRINTS_KEY   = 'aether_live_blueprints';
  var LIVE_CHECKPOINTS_KEY  = 'aether_live_checkpoints';

  /* ---------- Raw localStorage helpers ---------- */
  function lsGet(key){ try{ var v=localStorage.getItem(key); return v ? JSON.parse(v) : []; }catch(e){ return []; } }
  function lsSet(key, arr){ try{ localStorage.setItem(key, JSON.stringify(arr)); return true; }catch(e){ console.warn('AetherStore: localStorage write failed', e); return false; } }

  /* ---------- ID generator ---------- */
  function genId(prefix){ return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

  /* ---------- Date helper ---------- */
  function todayLabel(){
    var d = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate();
  }

  /* ============================================================
     MISSIONS
     ============================================================ */

  /* Returns LIVE missions from localStorage */
  function getLiveMissions(){ return lsGet(LIVE_MISSIONS_KEY); }

  /* Returns all missions visible to the current page:
     LIVE mode → only real missions
     SAMPLE mode → sample + real (real ones shown with a "LIVE" badge) */
  function getAllMissions(){
    var live = getLiveMissions();
    if(isLive()) return live;
    return sampleMissions.concat(live);
  }

  /* Create a new mission.
     Caller supplies: name, tagline, objective, domains[], icon, forecast
     Store fills: key, pct, camp, status, confidence, etc. */
  function saveMission(data){
    var missions = getLiveMissions();
    var now = todayLabel();
    var mission = {
      key:          genId('m'),
      name:         (data.name || '').trim(),
      tagline:      (data.tagline || '').trim(),
      objective:    (data.objective || '').trim(),
      domains:      data.domains || [],
      icon:         data.icon || 'mountain',
      mountainStyle: data.mountainStyle || 'alpine',
      forecast:     data.forecast || 'Unknown',
      deadline:     (data.deadline || '').trim(), /* ISO date (YYYY-MM-DD) from a real <input type="date">
        -- unlike every other date in AETHER (todayLabel() strings with no year), this one needs real date
        math for "overdue by N days" to mean anything, so it's stored unambiguously. */
      /* computed fields — start at zero, engine will update */
      pct:          0,
      camp:         'Base Camp',
      nextCamp:     'Camp I',
      confidence:   0,
      confidenceGain: 0,
      weather:      'Clear Skies',
      lastActivity: 'Just now',
      status:       'stable',
      milestones:   [],
      evidence:     [],
      blocked:      false,
      stalledDays:  0,
      blocker:      '',
      recoveryAction: '',
      impact:       '',
      createdAt:    now,
      isLive:       true   /* flag so pages can distinguish real vs sample */
    };
    missions.push(mission);
    lsSet(LIVE_MISSIONS_KEY, missions);

    if(isLive()){
      addTimelineEvent({
        type: 'mission',
        name: mission.name + ' mission created',
        sub:  mission.tagline || 'New expedition established'
      });
    }

    return mission;
  }

  /* Update an existing LIVE mission by key */
  function updateMission(key, changes){
    var missions = getLiveMissions();
    var idx = missions.findIndex(function(m){ return m.key === key; });
    if(idx === -1) return false;
    missions[idx] = Object.assign({}, missions[idx], changes);
    return lsSet(LIVE_MISSIONS_KEY, missions);
  }

  /* Delete a LIVE mission and all its blueprints/checkpoints */
  function deleteMission(key){
    var mission = getLiveMissions().find(function(m){ return m.key === key; });
    var missions = getLiveMissions().filter(function(m){ return m.key !== key; });
    lsSet(LIVE_MISSIONS_KEY, missions);

    /* cascade: remove blueprints belonging to this mission */
    var removedBps = getLiveBlueprints().filter(function(b){ return b.missionKey === key; });
    var bps = getLiveBlueprints().filter(function(b){ return b.missionKey !== key; });
    lsSet(LIVE_BLUEPRINTS_KEY, bps);

    /* cascade: remove checkpoints belonging to those blueprints */
    var remainingBpKeys = bps.map(function(b){ return b.key; });
    var cps = getLiveCheckpoints().filter(function(c){ return remainingBpKeys.indexOf(c.blueprintKey) !== -1; });
    lsSet(LIVE_CHECKPOINTS_KEY, cps);

    /* cascade: wipe each removed blueprint's checkpoint-done-state blob —
       this lives under its own localStorage key, entirely separate from
       the checkpoint list itself, and was previously left behind */
    removedBps.forEach(function(b){
      try{ localStorage.removeItem('aether_cp_' + b.key); }catch(e){}
    });

    /* cascade: remove blockers that point at this mission — a blocker
       for a mission that no longer exists isn't a record worth keeping */
    var blockers = getLiveBlockers().filter(function(b){
      return b.affectedMissionKey !== key && b.affectedMission !== (mission ? mission.name : '__none__');
    });
    lsSet(LIVE_BLOCKERS_KEY, blockers);

    /* cascade: remove evidence tied to this mission or its blueprints */
    var evidence = getLiveEvidence().filter(function(e){
      var tiedToMission = e.missionKey === key;
      var tiedToRemovedBp = removedBps.some(function(b){ return b.key === e.blueprintKey; });
      return !tiedToMission && !tiedToRemovedBp;
    });
    lsSet(LIVE_EVIDENCE_KEY, evidence);

    /* cascade: remove defer-log entries mentioning this mission by name,
       so recurring-avoidance pattern detection doesn't reference a ghost */
    if(mission){
      var deferLog = getDeferLog().filter(function(d){ return d.missionName !== mission.name; });
      lsSet(DEFER_LOG_KEY, deferLog);
    }

    /* cascade: clear the "active blueprint" pointer if it pointed at
       something we just deleted, so Start Climb never links to a ghost */
    try{
      var activeBp = localStorage.getItem('aether_active_blueprint_key');
      if(activeBp && removedBps.some(function(b){ return b.key === activeBp; })){
        localStorage.removeItem('aether_active_blueprint_key');
      }
    }catch(e){}

    /* cascade: remove timeline events that reference this mission or its blueprints,
       so deleting a mission doesn't leave orphaned history behind */
    var removedNames = [mission ? mission.name : null].concat(removedBps.map(function(b){ return b.name; })).filter(Boolean);
    if(removedNames.length){
      var events = getLiveTimelineEvents().filter(function(e){
        var matchesExactly = removedNames.indexOf(e.sub) !== -1 || removedNames.indexOf(e.name) !== -1;
        var matchesMissionCreated = mission && e.name === (mission.name + ' mission created');
        return !matchesExactly && !matchesMissionCreated;
      });
      lsSet(LIVE_TIMELINE_KEY, events);
    }
    return true;
  }

  /* ============================================================
     BLUEPRINTS
     ============================================================ */

  function getLiveBlueprints(){ return lsGet(LIVE_BLUEPRINTS_KEY); }

  function getAllBlueprints(){
    var live = getLiveBlueprints();
    if(isLive()) return live;
    return sampleBlueprints.concat(live);
  }

  /* Create a blueprint under a mission.
     Caller supplies: missionKey, name, objective, currentPhase,
                      nextMilestone, hazard, recovery, evidence */
  function saveBlueprint(data){
    var blueprints = getLiveBlueprints();
    var missions   = getLiveMissions();
    var mission    = missions.find(function(m){ return m.key === data.missionKey; }) || {};
    var now        = todayLabel();
    var bp = {
      key:           genId('bp'),
      missionKey:    data.missionKey || '',
      missionName:   mission.name || data.missionName || '',
      name:          (data.name || '').trim(),
      icon:          mission.icon || 'mountain',
      objective:     (data.objective || '').trim(),
      currentPhase:  (data.currentPhase || 'Phase 1').trim(),
      nextMilestone: (data.nextMilestone || '').trim(),
      hazard:        (data.hazard || '').trim(),
      recovery:      (data.recovery || '').trim(),
      evidence:      (data.evidence || '').trim(),
      pct:           0,
      confidence:    0,
      status:        'stable',
      createdAt:     now,
      isLive:        true
    };
    blueprints.push(bp);
    lsSet(LIVE_BLUEPRINTS_KEY, blueprints);
    return bp;
  }

  function updateBlueprint(key, changes){
    var blueprints = getLiveBlueprints();
    var idx = blueprints.findIndex(function(b){ return b.key === key; });
    if(idx === -1) return false;
    blueprints[idx] = Object.assign({}, blueprints[idx], changes);
    return lsSet(LIVE_BLUEPRINTS_KEY, blueprints);
  }

  function deleteBlueprint(key){
    var blueprint = getLiveBlueprints().find(function(b){ return b.key === key; });
    var blueprints = getLiveBlueprints().filter(function(b){ return b.key !== key; });
    lsSet(LIVE_BLUEPRINTS_KEY, blueprints);

    var cps = getLiveCheckpoints().filter(function(c){ return c.blueprintKey !== key; });
    lsSet(LIVE_CHECKPOINTS_KEY, cps);

    /* wipe this blueprint's checkpoint-done-state blob — separate key, previously orphaned */
    try{ localStorage.removeItem('aether_cp_' + key); }catch(e){}

    /* clear the active-blueprint pointer if it pointed here */
    try{
      var activeBp = localStorage.getItem('aether_active_blueprint_key');
      if(activeBp === key) localStorage.removeItem('aether_active_blueprint_key');
    }catch(e){}

    if(blueprint){
      /* remove blockers scoped to this specific blueprint (not the whole mission) */
      var blockers = getLiveBlockers().filter(function(b){ return b.affectedBlueprint !== blueprint.name; });
      lsSet(LIVE_BLOCKERS_KEY, blockers);

      /* remove evidence tied to this specific blueprint */
      var evidence = getLiveEvidence().filter(function(e){ return e.blueprintKey !== key; });
      lsSet(LIVE_EVIDENCE_KEY, evidence);

      var events = getLiveTimelineEvents().filter(function(e){
        return e.sub !== blueprint.name && e.name !== blueprint.name;
      });
      lsSet(LIVE_TIMELINE_KEY, events);

      /* Removing a whole blueprint changes what the parent mission's
         pct averages over — same stale-number risk as deleting a
         single checkpoint, just one level up. Recalculate from
         whatever blueprints remain, or zero it honestly if none do. */
      var remainingBps = getLiveBlueprints().filter(function(b){ return b.missionKey === blueprint.missionKey; });
      if(remainingBps.length){
        recalcBlueprintProgress(remainingBps[0].key);
      } else {
        updateMission(blueprint.missionKey, { pct: 0, camp: 'Base Camp' });
      }
    }
    return true;
  }

  /* ============================================================
     CHECKPOINTS
     ============================================================ */

  function getLiveCheckpoints(){ return lsGet(LIVE_CHECKPOINTS_KEY); }

  /* Returns checkpoints for a specific blueprint key */
  function getCheckpointsForBlueprint(blueprintKey){
    return getLiveCheckpoints().filter(function(c){ return c.blueprintKey === blueprintKey; });
  }

  /* In SAMPLE mode, return sample checkpoints. In LIVE mode, return all live checkpoints. */
  function getAllCheckpoints(){
    if(isLive()) return getLiveCheckpoints();
    return sampleCheckpoints.concat(getLiveCheckpoints());
  }

  /* Create a checkpoint under a blueprint.
     Caller supplies: blueprintKey, name, evidenceRequired, confidenceValue
     Each checkpoint also stores its done/verified state in localStorage
     so it persists across page reloads — same mechanism as before, now
     also attached to a real blueprint. */
  function saveCheckpoint(data){
    var checkpoints = getLiveCheckpoints();
    var now = todayLabel();
    var cp = {
      id:               genId('cp'),
      blueprintKey:     data.blueprintKey || '',
      name:             (data.name || '').trim(),
      evidenceRequired: (data.evidenceRequired || '').trim(),
      confidenceValue:  parseInt(data.confidenceValue, 10) || 1,
      defaultDone:      false,
      defaultVerified:  false,
      completedDate:    null,
      createdAt:        now,
      isLive:           true,
      sortOrder:        checkpoints.filter(function(c){ return c.blueprintKey === data.blueprintKey; }).length
    };
    checkpoints.push(cp);
    lsSet(LIVE_CHECKPOINTS_KEY, checkpoints);
    return cp;
  }

  /* Toggle checkpoint done/verified state — persists to localStorage */
  function toggleCheckpointDone(cpId, blueprintKey){
    var storeKey = 'aether_cp_' + (blueprintKey || 'default');
    var state = {};
    try { state = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch(e){}
    var wasDone = !!state[cpId];
    state[cpId] = state[cpId] === undefined ? true : !state[cpId];
    try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch(e){}

    /* Only log a timeline event when a step is newly completed —
       unchecking isn't a "victory" worth recording. */
    if(isLive() && !wasDone && state[cpId]){
      var cp = getLiveCheckpoints().find(function(c){ return c.id === cpId; });
      var bp = getAllBlueprints().find(function(b){ return b.key === blueprintKey; });
      addTimelineEvent({
        type: 'verified',
        name: (cp ? cp.name : 'Step') + ' Verified',
        sub:  bp ? bp.name : '',
        delta: cp && cp.confidenceValue ? '+' + cp.confidenceValue : ''
      });
    }
    return state[cpId];
  }

  /* Read checkpoint done states for a blueprint */
  function getCheckpointStates(blueprintKey){
    var storeKey = 'aether_cp_' + (blueprintKey || 'default');
    try { return JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch(e){ return {}; }
  }

  /* Reorder checkpoint within its blueprint */
  function reorderCheckpoint(cpId, direction){
    var cps = getLiveCheckpoints();
    var idx = cps.findIndex(function(c){ return c.id === cpId; });
    if(idx === -1) return false;
    var bpKey = cps[idx].blueprintKey;
    var bpCps = cps.filter(function(c){ return c.blueprintKey === bpKey; });
    var bpIdx = bpCps.findIndex(function(c){ return c.id === cpId; });
    if(direction === 'up' && bpIdx === 0) return false;
    if(direction === 'down' && bpIdx === bpCps.length - 1) return false;
    var swapIdx = direction === 'up' ? bpIdx - 1 : bpIdx + 1;
    var temp = bpCps[bpIdx].sortOrder;
    bpCps[bpIdx].sortOrder = bpCps[swapIdx].sortOrder;
    bpCps[swapIdx].sortOrder = temp;
    /* write back */
    bpCps.forEach(function(bc){
      var gi = cps.findIndex(function(c){ return c.id === bc.id; });
      if(gi !== -1) cps[gi].sortOrder = bc.sortOrder;
    });
    return lsSet(LIVE_CHECKPOINTS_KEY, cps);
  }

  function deleteCheckpoint(cpId){
    var cp = getLiveCheckpoints().find(function(c){ return c.id === cpId; });
    var cps = getLiveCheckpoints().filter(function(c){ return c.id !== cpId; });
    lsSet(LIVE_CHECKPOINTS_KEY, cps);

    /* evidence attached to this specific step no longer has anything to prove */
    var evidence = getLiveEvidence().filter(function(e){ return e.checkpointId !== cpId; });
    lsSet(LIVE_EVIDENCE_KEY, evidence);

    /* this step's timeline "verified" entry, if any, referenced it by name */
    if(cp){
      var events = getLiveTimelineEvents().filter(function(e){ return e.name !== (cp.name + ' Verified'); });
      lsSet(LIVE_TIMELINE_KEY, events);
    }

    /* Removing a step changes the denominator for blueprint/mission
       pct (e.g. 2/4 done becomes 2/3) — recalculate immediately so the
       stored percentage can never quietly go stale until the next
       unrelated checkpoint toggle happens to trigger it. */
    if(cp && cp.blueprintKey) recalcBlueprintProgress(cp.blueprintKey);

    return true;
  }

  /* ============================================================
     BLUEPRINT PROGRESS RECALC
     Called after checkpoint state changes to keep blueprint.pct
     and mission.pct in sync with actual done checkpoints.
     ============================================================ */
  function recalcBlueprintProgress(blueprintKey){
    var cps     = getCheckpointsForBlueprint(blueprintKey);
    var states  = getCheckpointStates(blueprintKey);
    if(cps.length === 0) return;
    var done    = cps.filter(function(c){ return states[c.id]; }).length;
    var pct     = Math.round((done / cps.length) * 100);
    var camp    = pct >= 90 ? 'Camp V' : pct >= 75 ? 'Camp IV' : pct >= 50 ? 'Camp III' : pct >= 28 ? 'Camp II' : pct >= 15 ? 'Camp I' : 'Base Camp';
    updateBlueprint(blueprintKey, { pct: pct });
    /* also update parent mission */
    var bp = getLiveBlueprints().find(function(b){ return b.key === blueprintKey; });
    if(bp && bp.missionKey){
      var allBps = getLiveBlueprints().filter(function(b){ return b.missionKey === bp.missionKey; });
      if(allBps.length > 0){
        var avgPct = Math.round(allBps.reduce(function(s,b){ return s + b.pct; }, 0) / allBps.length);
        updateMission(bp.missionKey, { pct: avgPct, camp: camp });
      }
    }
  }

  /* ============================================================
     PHASE 4B — LIVE BLOCKERS
     Real operator-entered blockers. Separate from sample blockers.
     getAllBlockers() merges both in SAMPLE mode, returns only live
     in LIVE mode — same pattern as missions/blueprints/checkpoints.
     ============================================================ */

  var LIVE_BLOCKERS_KEY = 'aether_live_blockers';

  function getLiveBlockers(){ return lsGet(LIVE_BLOCKERS_KEY); }

  function getAllBlockers(){
    var live = getLiveBlockers();
    if(isLive()) return live;
    return sampleBlockers.concat(live);
  }

  /* Save a new real blocker.
     Caller supplies: name, severity, affectedMissionKey, affectedMissionName,
                      affectedBlueprintName, recoveryPlan */
  function saveBlocker(data){
    var blockers = getLiveBlockers();
    var now = todayLabel();
    var blocker = {
      key:              genId('blk'),
      name:             (data.name || '').trim(),
      severity:         data.severity || 'Medium',   /* High | Medium | Low */
      status:           'open',
      affectedMission:  data.affectedMissionName || data.affectedMission || '',
      affectedMissionKey: data.affectedMissionKey || '',
      affectedBlueprint: data.affectedBlueprintName || data.affectedBlueprint || '',
      owner:            'Rod Entera',
      dateDiscovered:   now,
      recoveryPlan:     (data.recoveryPlan || '').trim(),
      daysOpen:         0,
      isLive:           true,
      createdAt:        now
    };
    blockers.push(blocker);
    lsSet(LIVE_BLOCKERS_KEY, blockers);
    return blocker;
  }

  function updateBlocker(key, changes){
    var blockers = getLiveBlockers();
    var idx = blockers.findIndex(function(b){ return b.key === key; });
    if(idx === -1) return false;
    blockers[idx] = Object.assign({}, blockers[idx], changes);
    return lsSet(LIVE_BLOCKERS_KEY, blockers);
  }

  function resolveBlocker(key, solution){
    var changes = { status: 'resolved' };
    if(solution && solution.trim()) changes.solution = solution.trim();
    var ok = updateBlocker(key, changes);
    if(ok && isLive()){
      var blocker = getLiveBlockers().find(function(b){ return b.key === key; });
      addTimelineEvent({
        type: 'resolved',
        name: blocker ? blocker.name : 'Blocker resolved',
        sub:  'Cleared from trail'
      });
    }
    return ok;
  }

  function deleteBlocker(key){
    var blocker = getLiveBlockers().find(function(b){ return b.key === key; });
    var blockers = getLiveBlockers().filter(function(b){ return b.key !== key; });
    lsSet(LIVE_BLOCKERS_KEY, blockers);
    if(blocker){
      var events = getLiveTimelineEvents().filter(function(e){ return e.name !== blocker.name; });
      lsSet(LIVE_TIMELINE_KEY, events);
    }
    return true;
  }

  /* Increment daysOpen for all open live blockers — call once per day */
  function ageLiveBlockers(){
    var blockers = getLiveBlockers();
    var updated = false;
    blockers.forEach(function(b){
      if(b.status === 'open'){ b.daysOpen = (b.daysOpen || 0) + 1; updated = true; }
    });
    if(updated) lsSet(LIVE_BLOCKERS_KEY, blockers);
  }

  /* This was built with "call once per day" as its whole design, but
     nothing in the app ever actually called it -- daysOpen has been
     frozen at its initial value since creation regardless of how long
     a blocker actually sat open. Fixed here: campaignStore.js loads on
     every page, so this runs once, right here, gated by a real
     calendar-day check. The marker is "aether_"-prefixed on purpose
     (unlike the local-only UI preference keys elsewhere in this app)
     so it syncs via Firestore -- without that, using AETHER on two
     computers on the same day could each independently decide "I
     haven't aged blockers today" and both increment, double-counting
     that day. */
  (function autoAgeBlockersOncePerDay(){
    var AGE_DATE_KEY = 'aether_blocker_age_date';
    try{
      var last = localStorage.getItem(AGE_DATE_KEY);
      var today = todayLabel();
      if(last !== today){
        ageLiveBlockers();
        localStorage.setItem(AGE_DATE_KEY, today);
      }
    }catch(e){ /* best-effort -- a missed aging tick isn't worth breaking page load over */ }
  })();

  /* ============================================================
     APPLICATIONS BUILT
     A registry of the actual software/apps the operator has built --
     AETHER itself, PRISM, POS tools, games, anything -- so there's one
     place that remembers all of them, shown alongside the "mountains
     climbed" (mission/domain) record rather than scattered across
     memory. Not job applications -- built applications.

     "aether_" prefixed on purpose (unlike voice/music preferences) --
     this is real campaign data and should sync across devices via
     Firestore exactly like missions and evidence do.
     ============================================================ */
  var LIVE_APPLICATIONS_KEY = 'aether_live_applications';

  function getApplications(){ return lsGet(LIVE_APPLICATIONS_KEY); }

  /* Caller supplies: name, type, platform, status, dateStarted, url, description */
  function saveApplication(data){
    var apps = getApplications();
    var now = todayLabel();
    var app = {
      key:          genId('app'),
      name:         (data.name || '').trim(),
      type:         (data.type || '').trim(),      /* e.g. Mobile App, Web App, POS System, Game, Automation Tool */
      platform:     (data.platform || '').trim(),  /* e.g. Web, Android, Desktop, GitHub Pages */
      status:       data.status || 'In Development', /* In Development | Launched | Maintained | Archived */
      domain:       (data.domain || '').trim(),     /* matches a real domain name from getDomains(), or blank */
      dateStarted:  (data.dateStarted || now).trim(),
      url:          (data.url || '').trim(),
      description:  (data.description || '').trim(),
      createdAt:    now
    };
    apps.unshift(app);
    lsSet(LIVE_APPLICATIONS_KEY, apps);
    return app;
  }

  function updateApplication(key, changes){
    var apps = getApplications();
    var idx = apps.findIndex(function(a){ return a.key === key; });
    if(idx === -1) return false;
    apps[idx] = Object.assign({}, apps[idx], changes);
    return lsSet(LIVE_APPLICATIONS_KEY, apps);
  }

  function deleteApplication(key){
    var apps = getApplications().filter(function(a){ return a.key !== key; });
    lsSet(LIVE_APPLICATIONS_KEY, apps);
    return true;
  }

  /* ============================================================
     PHASE 4B — LIVE DEBRIEFS
     Real operator debrief entries. Each debrief records:
     - date, worked, failed, changed, commandCompleted, failReason
     - evidenceCount, blockersCount, confidenceChange
     Stored oldest-first (same order as samplePastDebriefs) so
     pattern detection functions work identically on both.
     ============================================================ */

  var LIVE_DEBRIEFS_KEY = 'aether_live_debriefs';

  function getLiveDebriefs(){ return lsGet(LIVE_DEBRIEFS_KEY); }

  /* In SAMPLE mode: return sample debriefs PLUS real ones (real appended).
     In LIVE mode: return only real debriefs.
     Both return oldest-first so detectRecurringAvoidance() works correctly. */
  function getAllDebriefs(){
    var live = getLiveDebriefs();
    if(isLive()) return live;
    return samplePastDebriefs.concat(live);
  }

  /* Save a completed debrief entry.
     Caller supplies:
       worked          — string: what worked today
       failed          — string: what failed / was avoided
       changed         — string: what changed / what you decided
       notes           — string: anything else
       commandCompleted — bool: did operator complete Today's Command
       failReason      — string: why not, if commandCompleted === false
       evidenceCount   — int
       blockersCount   — int
       confidenceChange — int (can be negative)
  */
  function saveDebrief(data){
    var debriefs = getLiveDebriefs();
    var d = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
    var dateLabel = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    var day   = String(d.getDate());
    var month = months[d.getMonth()].toUpperCase();

    var entry = {
      day:               day,
      month:             month,
      date:              dateLabel,
      dateKey:           d.getFullYear() + '-' +
                         String(d.getMonth()+1).padStart(2,'0') + '-' +
                         String(d.getDate()).padStart(2,'0'),
      worked:            (data.worked  || '').trim(),
      failed:            (data.failed  || '').trim(),
      changed:           (data.changed || '').trim(),
      notes:             (data.notes   || '').trim(),
      commandCompleted:  data.commandCompleted !== undefined ? !!data.commandCompleted : null,
      failReason:        (data.failReason || '').trim(),
      evidenceCount:     parseInt(data.evidenceCount,  10) || 0,
      blockersCount:     parseInt(data.blockersCount,  10) || 0,
      confidenceChange:  parseInt(data.confidenceChange,10) || 0,
      isLive:            true,
      savedAt:           new Date().toISOString()
    };
    debriefs.push(entry);
    lsSet(LIVE_DEBRIEFS_KEY, debriefs);

    if(isLive()){
      addTimelineEvent({
        type: entry.commandCompleted ? 'verified' : 'checkpoint',
        name: 'Evening Debrief completed',
        sub:  entry.commandCompleted ? "Today's Command verified" : "Command not completed — " + (entry.failReason || 'logged for review')
      });
    }

    return entry;
  }

  function deleteDebrief(dateKey){
    var debriefs = getLiveDebriefs().filter(function(d){ return d.dateKey !== dateKey; });
    return lsSet(LIVE_DEBRIEFS_KEY, debriefs);
  }

  /* ============================================================
     PHASE 4B — DEFER TRACKING
     Deferred commands accumulate under a per-date key in
     daily-command.js, but pattern detection needs to know WHICH
     missions/checkpoints are being repeatedly deferred.
     This thin layer stores a deduplicated defer log so the
     intelligence engine can surface "recurring deferrals" as a
     pattern signal.
     ============================================================ */

  var DEFER_LOG_KEY = 'aether_defer_log';

  function getDeferLog(){ return lsGet(DEFER_LOG_KEY); }

  function logDefer(commandTitle, missionName, dateKey){
    var log = getDeferLog();
    log.push({
      commandTitle: commandTitle || '',
      missionName:  missionName  || '',
      dateKey:      dateKey || new Date().toISOString().slice(0,10),
      loggedAt:     new Date().toISOString()
    });
    lsSet(DEFER_LOG_KEY, log);
  }

  /* Returns missions deferred 2+ times, sorted by count descending */
  function getRecurringDeferrals(){
    var log = getDeferLog();
    var counts = {};
    log.forEach(function(entry){
      var key = entry.missionName || entry.commandTitle;
      counts[key] = (counts[key] || 0) + 1;
    });

    /* A mission deferred twice last month but summited since is not a
       "pattern" anymore — it's finished. Without this check, any
       mission that was ever deferred 2+ times in its history stays
       flagged as "repeatedly deferred" forever, even after 100%
       completion, which is exactly the kind of stale, not-actually-
       intelligent suggestion the daily command system exists to avoid.
       Only living, still-incomplete missions can be a live pattern. */
    var missions = getAllMissions ? getAllMissions() : getMissions();
    var statusByName = {};
    missions.forEach(function(m){ statusByName[m.name] = m; });

    return Object.keys(counts)
      .filter(function(k){ return counts[k] >= 2; })
      .filter(function(k){
        var m = statusByName[k];
        return m && m.pct < 100; /* drop missions that no longer exist or are already summited */
      })
      .map(function(k){ return { name: k, count: counts[k] }; })
      .sort(function(a,b){ return b.count - a.count; });
  }

  /* ============================================================
     CLEAR ALL LIVE DATA — wipe every real operator entry.
     Removes missions, blueprints, checkpoints, checkpoint states,
     blockers, debriefs, defer log, daily command records, and
     evidence verification states. Does NOT touch sample data,
     system mode, operator profile, or settings. This is the
     "start my real campaign over" button.
     Returns a count of what was removed.
     ============================================================ */
  function clearAllLiveData(){
    var removed = {
      missions:    getLiveMissions().length,
      blueprints:  getLiveBlueprints().length,
      checkpoints: getLiveCheckpoints().length,
      blockers:    getLiveBlockers().length,
      debriefs:    getLiveDebriefs().length,
      evidence:    getLiveEvidence().length,
      timeline:    getLiveTimelineEvents().length
    };

    /* Core live collections */
    try{ localStorage.removeItem(LIVE_MISSIONS_KEY); }catch(e){}
    try{ localStorage.removeItem(LIVE_BLUEPRINTS_KEY); }catch(e){}
    try{ localStorage.removeItem(LIVE_CHECKPOINTS_KEY); }catch(e){}
    try{ localStorage.removeItem(LIVE_BLOCKERS_KEY); }catch(e){}
    try{ localStorage.removeItem(LIVE_DEBRIEFS_KEY); }catch(e){}
    try{ localStorage.removeItem(LIVE_EVIDENCE_KEY); }catch(e){}
    try{ localStorage.removeItem(LIVE_TIMELINE_KEY); }catch(e){}
    try{ localStorage.removeItem(DEFER_LOG_KEY); }catch(e){}

    /* Sweep prefixed keys: checkpoint states, daily command records,
       evidence states. Collect first, then remove (can't mutate while iterating). */
    var toRemove = [];
    try{
      for(var i=0; i<localStorage.length; i++){
        var k = localStorage.key(i);
        if(!k) continue;
        if(k.indexOf('aether_cp_') === 0)        toRemove.push(k); /* checkpoint done-states */
        else if(k.indexOf('aether_daily_cmd_')===0) toRemove.push(k); /* daily command records */
        else if(k === 'aether_evidence_states')   toRemove.push(k); /* evidence verify states */
      }
      toRemove.forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
    }catch(e){}

    return removed;
  }

  /* ============================================================
     EXPORT / IMPORT — real, complete data portability.
     Gathers every real localStorage key that makes up "your
     campaign": the core collections plus every prefixed key
     (checkpoint done-states, daily command records, evidence
     verification states, defer log) via the same generic sweep
     clearAllLiveData already uses, so export and delete can never
     silently disagree about what counts as real data. This is the
     actual backup mechanism — the only copy of a user's campaign
     lives in their browser's localStorage, so this is what stands
     between them and total data loss.
     ============================================================ */
  function exportAllLiveData(){
    var data = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      systemMode: getSystemMode(),
      missions:    getLiveMissions(),
      blueprints:  getLiveBlueprints(),
      checkpoints: getLiveCheckpoints(),
      blockers:    getLiveBlockers(),
      debriefs:    getLiveDebriefs(),
      evidence:    getLiveEvidence(),
      timeline:    getLiveTimelineEvents(),
      prefixedKeys: {}
    };
    try{
      for(var i=0; i<localStorage.length; i++){
        var k = localStorage.key(i);
        if(!k) continue;
        if(k.indexOf('aether_cp_') === 0 || k.indexOf('aether_daily_cmd_') === 0 ||
           k === 'aether_evidence_states' || k === DEFER_LOG_KEY){
          data.prefixedKeys[k] = localStorage.getItem(k);
        }
      }
    }catch(e){}
    return data;
  }

  /* Restores a previously-exported object. Overwrites current LIVE
     data with whatever the export contains — caller is responsible
     for confirming with the user first, since this can't be undone
     once real data is overwritten. Missing fields in the import are
     left untouched rather than wiped, so a partial/older export
     doesn't destroy newer data it doesn't know about. */
  function importAllLiveData(data){
    if(!data || typeof data !== 'object') return false;
    try{
      if(data.missions)    lsSet(LIVE_MISSIONS_KEY, data.missions);
      if(data.blueprints)  lsSet(LIVE_BLUEPRINTS_KEY, data.blueprints);
      if(data.checkpoints) lsSet(LIVE_CHECKPOINTS_KEY, data.checkpoints);
      if(data.blockers)    lsSet(LIVE_BLOCKERS_KEY, data.blockers);
      if(data.debriefs)    lsSet(LIVE_DEBRIEFS_KEY, data.debriefs);
      if(data.evidence)    lsSet(LIVE_EVIDENCE_KEY, data.evidence);
      if(data.timeline)    lsSet(LIVE_TIMELINE_KEY, data.timeline);
      if(data.prefixedKeys){
        Object.keys(data.prefixedKeys).forEach(function(k){
          try{ localStorage.setItem(k, data.prefixedKeys[k]); }catch(e){}
        });
      }
      if(data.systemMode) setSystemMode(data.systemMode);
      return true;
    }catch(e){ return false; }
  }

  /* Local, in-browser safety net — separate from the file-based export
     above. Saves a full snapshot under its own key so "Restore Backup"
     can recover from an accidental wipe without needing a previously
     downloaded file on hand. */
  var LAST_BACKUP_KEY = 'aether_last_backup';
  function createLocalBackup(){
    var snapshot = exportAllLiveData();
    try{
      localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify(snapshot));
      return snapshot;
    }catch(e){ return null; }
  }
  function getLocalBackupInfo(){
    try{
      var raw = localStorage.getItem(LAST_BACKUP_KEY);
      if(!raw) return null;
      var parsed = JSON.parse(raw);
      return { exportedAt: parsed.exportedAt };
    }catch(e){ return null; }
  }
  function restoreLocalBackup(){
    try{
      var raw = localStorage.getItem(LAST_BACKUP_KEY);
      if(!raw) return false;
      return importAllLiveData(JSON.parse(raw));
    }catch(e){ return false; }
  }

  global.AetherStore = {
    getSystemMode: getSystemMode,
    setSystemMode: setSystemMode,
    isLive: isLive,
    getDomains: getDomains,
    getMissions: getMissions,
    getBlueprints: getBlueprints,
    getCheckpoints: getCheckpoints,
    getBlockers: getBlockers,
    getEvidence: getEvidence,
    saveEvidence: saveEvidence,
    deleteEvidence: deleteEvidence,
    updateEvidenceStatus: updateEvidenceStatus,
    getTimelineEvents: getTimelineEvents,
    getTodaysEvents: getTodaysEvents,
    addTimelineEvent: addTimelineEvent,
    getPastDebriefs: getPastDebriefs,
    getMilestones: getMilestones,
    getCampData: getCampData,
    getElevationGains: getElevationGains,
    getDashboardDomains: getDashboardDomains,
    getThreats: getThreats,
    getOpportunities: getOpportunities,
    getVictories: getVictories,
    getTerrains: getTerrains,
    getConfidenceHistory: getConfidenceHistory,
    getCampaignMeta: getCampaignMeta,
    purgeSampleData: purgeSampleData,
    /* Phase 4A — Live Data API */
    getAllMissions:             getAllMissions,
    getLiveMissions:            getLiveMissions,
    saveMission:                saveMission,
    updateMission:              updateMission,
    deleteMission:              deleteMission,
    getAllBlueprints:            getAllBlueprints,
    getLiveBlueprints:          getLiveBlueprints,
    saveBlueprint:              saveBlueprint,
    updateBlueprint:            updateBlueprint,
    deleteBlueprint:            deleteBlueprint,
    getAllCheckpoints:           getAllCheckpoints,
    getLiveCheckpoints:         getLiveCheckpoints,
    getCheckpointsForBlueprint: getCheckpointsForBlueprint,
    saveCheckpoint:             saveCheckpoint,
    deleteCheckpoint:           deleteCheckpoint,
    reorderCheckpoint:          reorderCheckpoint,
    toggleCheckpointDone:       toggleCheckpointDone,
    getCheckpointStates:        getCheckpointStates,
    recalcBlueprintProgress:    recalcBlueprintProgress,
    /* Phase 4B — Live Blockers */
    getLiveBlockers:    getLiveBlockers,
    getAllBlockers:      getAllBlockers,
    saveBlocker:        saveBlocker,
    updateBlocker:      updateBlocker,
    resolveBlocker:     resolveBlocker,
    deleteBlocker:      deleteBlocker,
    ageLiveBlockers:    ageLiveBlockers,
    /* Applications Built */
    getApplications:     getApplications,
    saveApplication:     saveApplication,
    updateApplication:   updateApplication,
    deleteApplication:   deleteApplication,
    /* Phase 4B — Live Debriefs */
    getLiveDebriefs:    getLiveDebriefs,
    getAllDebriefs:      getAllDebriefs,
    saveDebrief:        saveDebrief,
    deleteDebrief:      deleteDebrief,
    /* Phase 4B — Defer Tracking */
    getDeferLog:           getDeferLog,
    logDefer:              logDefer,
    getRecurringDeferrals: getRecurringDeferrals,
    clearAllLiveData:      clearAllLiveData,
    exportAllLiveData:     exportAllLiveData,
    importAllLiveData:     importAllLiveData,
    createLocalBackup:     createLocalBackup,
    getLocalBackupInfo:    getLocalBackupInfo,
    restoreLocalBackup:    restoreLocalBackup
  };

})(window);
