// Application entry point.
(function (global) {
  'use strict';

  function initApp() {
    global.AppNavigation.initNavigation();
    global.AppLawsView.initLawFilters();
    global.AppClassifyView.initClassifyForm();
    global.AppLawsView.renderLaws();
    if (global.AppQcvnView && global.AppQcvnView.initQcvnView) {
      global.AppQcvnView.initQcvnView();
    }
  }

  document.addEventListener('DOMContentLoaded', initApp);
})(window);
