// In-memory cache store to preserve FSE Overview and TL Overview data across page switching
const overviewCache = {};

export const getOverviewCache = (key) => {
  return overviewCache[key] || null;
};

export const setOverviewCache = (key, data) => {
  overviewCache[key] = data;
};

export const invalidateOverviewCache = (pattern) => {
  if (!pattern) {
    Object.keys(overviewCache).forEach(k => delete overviewCache[k]);
    return;
  }
  Object.keys(overviewCache).forEach(k => {
    if (k.includes(pattern)) delete overviewCache[k];
  });
};
