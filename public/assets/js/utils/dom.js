// Shared DOM helpers.
(function (global) {
  'use strict';

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function setActive(elements, activeElement, className = 'active') {
    elements.forEach((element) => element.classList.remove(className));
    if (activeElement) activeElement.classList.add(className);
  }

  global.AppDom = { qs, qsa, setActive };
})(window);
