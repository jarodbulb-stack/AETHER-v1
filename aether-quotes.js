/* ============================================================
   AETHER — DAILY QUOTE ROTATION
   40 original quotes — general, genuine life motivation about
   effort, discipline, and progress (not app instructions dressed
   up as quotes). Loosely uses the mountain/climb imagery to match
   AETHER's visual theme, but every line stands on its own for any
   real goal in life, not just this app. One shows per calendar
   day, deterministic — same quote all day, changes at local
   midnight, cycles back to #1 after day 40.

   Drop <script src="aether-quotes.js"></script> before </body>
   on every page, alongside aether-nav.js. It finds every element
   with class="profile-quote" (the sidebar quote box already used
   on all 11 pages) and fills it with today's quote automatically
   — no per-page wiring needed.
   ============================================================ */
(function(){
  'use strict';

  var QUOTES = [
    "The mountain doesn't ask if you're ready. It just waits for you to start.",
    "Small steps, taken daily, outlast big plans left undone.",
    "You don't need to see the whole path to take the next step.",
    "Discipline is choosing what you want most over what you want now.",
    "Progress is rarely loud. Most days it just looks like showing up.",
    "The person who reaches the top is built long before the summit.",
    "You are not behind. You are exactly where your effort has taken you.",
    "Every hard day you climb makes tomorrow a little easier.",
    "Growth hides in the days that don't feel like progress.",
    "The climb is the reward. The summit just proves it.",
    "You don't rise to your goals. You fall to your habits.",
    "Consistency is quieter than motivation, and it climbs further.",
    "Rest if you must, but don't quit the mountain.",
    "What you repeat, you become.",
    "The best time to start was earlier. The next best time is now.",
    "Every summit was once just someone's next step.",
    "You don't have to be fast. You just have to keep moving.",
    "Doubt kills more dreams than failure ever will.",
    "The path is made by walking it, not by planning it perfectly.",
    "Your future is built in the ordinary hours no one is watching.",
    "Strength isn't the absence of struggle. It's showing up inside it.",
    "You climb higher by learning to love the boring parts of the climb.",
    "One honest step today is worth more than ten imagined tomorrows.",
    "The mountain changes you before it ever lets you reach the top.",
    "Comparison is a cliff. Focus is a trail.",
    "You don't need permission to start climbing.",
    "Every setback is just a switchback — the path still goes up.",
    "Big dreams are climbed in small, unremarkable steps.",
    "The view from the top always excuses the weight of the climb.",
    "You are capable of more than the voice that tells you to stop.",
    "Patience is the quiet muscle behind every real achievement.",
    "Nobody climbs a mountain by staring at it.",
    "The work you do when no one's watching is the work that gets you there.",
    "A goal without daily action is just a wish wearing a deadline.",
    "The higher you climb, the more the small steps matter.",
    "You don't have to feel ready. You just have to start moving.",
    "The version of you who almost gave up isn't the one climbing today.",
    "Resilience is standing back up exactly where you fell.",
    "The summit remembers every step, even the ones that felt small.",
    "You are one decision away from a completely different climb."
  ];

  /* Deterministic day index: counts days since Jan 1 of the current
     year (local time), then wraps at 40. Same quote all day for
     everyone on the same local date, advances automatically at
     midnight, and restarts the cycle at #1 every 40 days. */
  function todayIndex(){
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 1);
    var days = Math.floor((now - start) / 86400000);
    return ((days % QUOTES.length) + QUOTES.length) % QUOTES.length;
  }

  function apply(){
    var els = document.querySelectorAll('.profile-quote');
    if(!els.length) return;
    var text = '"' + QUOTES[todayIndex()] + '"';
    for(var i=0;i<els.length;i++){ els[i].textContent = text; }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  /* Exposed for debugging / future use (e.g. a "quote of the day"
     widget elsewhere) — not required for the sidebar to work. */
  window.AetherQuotes = { list: QUOTES, todayIndex: todayIndex };
})();
