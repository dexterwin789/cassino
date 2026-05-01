const PUBLIC_ALLOWED_PROVIDER_PATTERN = '(pg soft|pgsoft|pg-soft|pragmatic)';
const PUBLIC_BROKEN_IMAGE_PATH_PATTERN = '%/Games/PP/%';

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

module.exports = { publicGameFilter, PUBLIC_ALLOWED_PROVIDER_PATTERN, PUBLIC_BROKEN_IMAGE_PATH_PATTERN };