// Providers with funded PlayFivers wallets (2026-05): Evolution, Pragmatic,
// PG Soft, NetEnt, Ezugi, Spribe + PlayFivers clones (same aggregator,
// alternate label without "OFICIAL -" prefix).
const PUBLIC_ALLOWED_PROVIDER_PATTERN = '(pg ?soft|pg-soft|pragmatic|evolution|spribe|netent|ezugi|evoplay|hacksaw|nolimit|red tiger|micro gaming|spinomenal|booming|bgaming|3oaks|habanero|playson|reelkingdom|booongo|cq9|tada|epicwin|fachai|jdb|live22|live88|spade gaming|big time gaming|advantplay|alize slots|askmeslot|aviatrix|cg|cp games|dreamgaming|fat ?panda|gtf|queenmaker|turbo games|winfinity|yellowbat|galaxsys|jetx|popok|toptrend|dreamtech|digitain)';

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