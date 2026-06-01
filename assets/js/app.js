// Application entry point.
(function (global) {
  'use strict';

  function initApp() {
    global.AppNavigation.initNavigation();
    global.AppLawsView.initLawFilters();
    global.AppClassifyView.initClassifyForm();
    global.AppLawsView.renderLaws();
  }

  document.addEventListener('DOMContentLoaded', initApp);
})(window);
