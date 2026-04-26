function column(alias, name) {
  return alias ? `${alias}.${name}` : name;
}

function liveCondition(alias = '') {
  const provider = `LOWER(COALESCE(${column(alias, 'provider')}, ''))`;
  const name = `LOWER(COALESCE(${column(alias, 'game_name')}, ''))`;
  const category = `LOWER(COALESCE(${column(alias, 'category')}, ''))`;
  return `(
    ${provider} LIKE '%live%'
    OR ${category} IN ('live', 'ao vivo', 'ao-vivo', 'casino_live', 'cassino-ao-vivo')
    OR ${name} LIKE '%live casino%'
  )`;
}

function categoryCondition(category, params, alias = '') {
  const normalized = String(category || '').trim().toLowerCase();
  if (!normalized) return '';

  const dbCategory = `LOWER(COALESCE(${column(alias, 'category')}, ''))`;
  const provider = `LOWER(COALESCE(${column(alias, 'provider')}, ''))`;
  const name = `LOWER(COALESCE(${column(alias, 'game_name')}, ''))`;
  const live = liveCondition(alias);

  if (['live', 'ao-vivo', 'ao vivo', 'cassino-ao-vivo', 'casino-live'].includes(normalized)) {
    return ` AND ${live}`;
  }

  if (['slots', 'slot'].includes(normalized)) {
    return ` AND ${dbCategory} = 'slots' AND NOT ${live}`;
  }

  if (normalized === 'pg') {
    return ` AND (${provider} LIKE '%pg soft%' OR ${provider} = 'pg' OR ${provider} = 'pgsoft')`;
  }

  if (normalized === 'crash') {
    return ` AND (${dbCategory} = 'crash' OR ${name} LIKE ANY (ARRAY['%aviator%', '%spaceman%', '%crash%'])) AND NOT ${live}`;
  }

  if (normalized === 'mines') {
    return ` AND (${dbCategory} = 'mines' OR ${name} LIKE '%mine%') AND NOT ${live}`;
  }

  params.push(normalized);
  return ` AND ${dbCategory} = LOWER($${params.length})`;
}

function categoryLabel(category) {
  const normalized = String(category || '').trim().toLowerCase();
  if (['live', 'ao-vivo', 'ao vivo', 'cassino-ao-vivo', 'casino-live'].includes(normalized)) return 'Cassino ao vivo';
  if (['slots', 'slot'].includes(normalized)) return 'Jogos Slots';
  if (normalized === 'pg') return 'PG Soft';
  if (normalized === 'crash') return 'Jogos Crash';
  if (normalized === 'mines') return 'Mines';
  return category;
}

module.exports = { categoryCondition, categoryLabel, liveCondition };