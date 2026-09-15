// units.js
// Définit les 3 grandeurs (masse, distance, volume), les 7 rangs de préfixes
// (k h da _ d c m) et des utilitaires pour le mode Custom (identifiants
// d'unité, regroupement par famille).

(function () {
  const PREFIXES = ['k', 'h', 'da', '', 'd', 'c', 'm'];
  // Exposant en base 10 associé à chaque rang (index 0 = k, index 6 = m)
  const EXPONENTS = [3, 2, 1, 0, -1, -2, -3];

  const CATEGORIES = [
    { key: 'masse', base: 'g' },
    { key: 'distance', base: 'm' },
    { key: 'volume', base: 'L' }
  ];

  const CATEGORY_LABELS = {
    masse: 'Masse',
    distance: 'Longueur',
    volume: 'Volume'
  };

  function unitLabel(category, rank) {
    return PREFIXES[rank] + category.base;
  }

  function categoryByKey(key) {
    return CATEGORIES.find((c) => c.key === key);
  }

  // Identifiant stable d'une unité, utilisé comme value d'option <select>
  // (ex: "distance:0" pour km)
  function unitId(categoryKey, rank) {
    return categoryKey + ':' + rank;
  }

  function parseUnitId(id) {
    const [categoryKey, rankStr] = id.split(':');
    return { categoryKey, rank: parseInt(rankStr, 10) };
  }

  // Retourne la liste des 7 unités d'une famille, dans l'ordre k -> m
  function unitsForCategory(categoryKey) {
    const category = categoryByKey(categoryKey);
    return PREFIXES.map((prefix, rank) => ({
      id: unitId(categoryKey, rank),
      rank,
      label: unitLabel(category, rank)
    }));
  }

  window.Units = {
    PREFIXES,
    EXPONENTS,
    CATEGORIES,
    CATEGORY_LABELS,
    unitLabel,
    categoryByKey,
    unitId,
    parseUnitId,
    unitsForCategory
  };
})();
