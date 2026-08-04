/* ============================================================
   AETHER — PWA
   Registers the service worker (sw.js) and manages the "Install
   AETHER" flow, exposed to Command Center via window.AetherPWA.

   Browsers handle installability very differently:
   - Chrome/Edge/most Android browsers: fire a beforeinstallprompt
     event when the app qualifies (manifest + service worker + a few
     other checks). We capture it, suppress the default mini-infobar,
     and trigger it ourselves from a real button instead.
   - iOS Safari: never fires beforeinstallprompt at all -- "Add to
     Home Screen" is a manual step in the Share menu. We just detect
     iOS and show instructions instead of a button, since there's no
     programmatic way to trigger it there.
   - Already running as an installed app: matchMedia('(display-mode:
     standalone)') tells us that, so the UI can say so instead of
     offering to install something that's already installed.

   Usage (Command Center):
     AetherPWA.isStandalone()   -> bool, already running as an app
     AetherPWA.isIOS()          -> bool
     AetherPWA.canPromptNow()   -> bool, a real install prompt is ready
     AetherPWA.promptInstall()  -> Promise<boolean accepted>
     Listen for 'aether-install-available' / 'aether-install-completed'
     on window if the UI wants to react live rather than poll.
   ============================================================ */
(function(){
  'use strict';

  if('serviceWorker' in navigator){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').catch(function(){
        /* Registration can fail (e.g. served over plain http on some
           setups) -- app still works perfectly without it, this is
           purely additive for offline/installability. */
      });
    });

    /* Service workers deliberately don't yank content out from under
       an already-open app -- an installed window left open across an
       update would otherwise keep running whatever was cached the
       moment it was installed, indefinitely, with no obvious sign
       anything's stale. When a new service worker actually takes
       over, reload once (guarded so this can never loop) so the app
       genuinely catches up to the latest deployed version. */
    var reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if(reloadedForUpdate) return;
      reloadedForUpdate = true;
      window.location.reload();
    });
  }

  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('aether-install-available'));
  });

  window.addEventListener('appinstalled', function(){
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('aether-install-completed'));
  });

  function isStandalone(){
    return (window.matchMedia && (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches
      )) ||
      window.navigator.standalone === true; /* iOS's own flag */
  }

  function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  function canPromptNow(){
    return !!deferredPrompt;
  }

  function promptInstall(){
    if(!deferredPrompt) return Promise.resolve(false);
    var promptEvent = deferredPrompt;
    deferredPrompt = null;
    promptEvent.prompt();
    return promptEvent.userChoice.then(function(choice){
      return choice.outcome === 'accepted';
    });
  }

  window.AetherPWA = {
    isStandalone: isStandalone,
    isIOS: isIOS,
    canPromptNow: canPromptNow,
    promptInstall: promptInstall
  };
})();
