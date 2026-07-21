function normalizeSourceAssetIds(sourceAssetIds) {
  if (!Array.isArray(sourceAssetIds)) return [];
  return [...new Set(sourceAssetIds
    .map((assetId) => String(assetId || '').trim())
    .filter((assetId) => assetId.length > 0 && assetId.length <= 500))]
    .slice(0, 100);
}

/** Lineage uses the item transaction so completion metadata cannot commit partially. */
async function recordDerivedAssetLineage(userId, derivedAssetId, sourceAssetIds, params, client) {
  const normalizedSources = normalizeSourceAssetIds(sourceAssetIds);
  if (normalizedSources.length === 0) return;
  await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
  for (const sourceAssetId of normalizedSources) {
    await client.query(
      `INSERT INTO public.asset_lineage_relations (
        user_id, source_asset_id, derived_asset_id, relation, params_json
      ) VALUES ($1, $2, $3, 'derived-from', $4::jsonb)
      ON CONFLICT (user_id, source_asset_id, derived_asset_id, relation) DO NOTHING`,
      [userId, sourceAssetId, derivedAssetId, JSON.stringify(params || {})],
    );
  }
}

module.exports = { recordDerivedAssetLineage };
