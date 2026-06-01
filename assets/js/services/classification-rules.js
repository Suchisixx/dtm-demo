// Small reusable rules for project classification.
(function (global) {
  'use strict';

  function getCapacityLabel(projectType) {
    const { IND_DB } = global.AppData;
    return projectType && IND_DB[projectType]
      ? IND_DB[projectType].lbl
      : 'Quy mô / Công suất *';
  }

  function findIndustryTier(projectType, capacity) {
    const { IND_DB } = global.AppData;
    const tiers = IND_DB[projectType].t;
    let match = tiers[tiers.length - 1];

    for (const tier of tiers) {
      if (capacity >= tier.min) {
        match = tier;
        break;
      }
    }

    return match;
  }

  function isForcedGroupOne({ rung, lua, bg }) {
    return rung || lua || bg;
  }

  global.AppClassificationRules = { getCapacityLabel, findIndustryTier, isForcedGroupOne };
})(window);
