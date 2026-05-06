// Providers validated by real launch audit (2026-05-06).
// Rule: use OFICIAL when that wallet works; use clone only when the official
// provider has no usable wallet (PGSOFT/CQ9/EVOPLAY/etc.).
const PUBLIC_ALLOWED_PROVIDER_PATTERN = '^(pgsoft|booongo|cq9|evoplay|popok|toptrend|oficial - evolution live|oficial - ezugi|oficial - fat panda|oficial - netent|oficial - pragmatic live|oficial - pragmatic slots|oficial - spribe)$';

const PUBLIC_BROKEN_IMAGE_PATH_PATTERN = '%/Games/PP/%';

// SQL fragment to strip "OFICIAL - " prefix from provider for display.
// Returns: TRIM(REGEXP_REPLACE(COALESCE(<alias>.provider, ''), '^OFICIAL\\s*-\\s*', '', 'i'))
function PROVIDER_CLEAN_SQL(alias) {
  const c = alias ? `${alias}.provider` : 'provider';
  return `TRIM(REGEXP_REPLACE(COALESCE(${c}, ''), '^OFICIAL\\s*-\\s*', '', 'i'))`;
}

function col(alias, name) {
  return alias ? `${alias}.${name}` : name;
}

function publicGameFilter(alias = '') {
  const imageUrl = col(alias, 'image_url');
  return `${col(alias, 'is_active')} = TRUE
    AND ${col(alias, 'pf_game_code')} IS NOT NULL AND ${col(alias, 'pf_game_code')} <> ''
    AND ${imageUrl} IS NOT NULL AND ${imageUrl} <> ''
    AND ${imageUrl} NOT ILIKE '${PUBLIC_BROKEN_IMAGE_PATH_PATTERN}'
    AND LOWER(COALESCE(${col(alias, 'pf_provider')}, ${col(alias, 'provider')}, '')) ~ '${PUBLIC_ALLOWED_PROVIDER_PATTERN}'`;
}

module.exports = {
  publicGameFilter,
  PUBLIC_ALLOWED_PROVIDER_PATTERN,
  PUBLIC_BROKEN_IMAGE_PATH_PATTERN,
  PROVIDER_CLEAN_SQL
};