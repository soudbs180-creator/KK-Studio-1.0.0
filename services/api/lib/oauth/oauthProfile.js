function normalizeProviders(hasPassword, identityProviders) {
  return Array.from(new Set([
    ...(hasPassword ? ['password'] : []),
    ...(Array.isArray(identityProviders) ? identityProviders : []),
  ].map((provider) => String(provider || '').trim().toLowerCase()).filter(Boolean)));
}

function buildOAuthProfile(user) {
  const email = String(user.email || '').trim();
  const timestamp = user.updated_at || user.created_at || new Date().toISOString();
  const providers = normalizeProviders(user.has_password, user.providers);
  const adminLevel = Number(user.admin_level || 0);
  return {
    id: user.id,
    email,
    nickname: String(user.display_name || '').trim() || email.split('@')[0] || 'KK User',
    avatarUrl: String(user.avatar_url || '').trim(),
    authProvider: providers[0] || 'password',
    providers,
    adminLevel,
    role: adminLevel > 0 ? 'admin' : 'user',
    status: 'active',
    createdAt: user.created_at || timestamp,
    updatedAt: timestamp,
  };
}

async function loadOAuthProfile(pool, userId) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, u.avatar_url, u.created_at, u.updated_at,
            (u.password_hash IS NOT NULL) AS has_password,
            COALESCE(u.admin_level, 0) AS admin_level,
            ARRAY(
              SELECT identity.provider
                FROM public.auth_identities identity
               WHERE identity.user_id = u.id
               ORDER BY identity.created_at ASC
            ) AS providers
       FROM public.users u
      WHERE u.id = $1`,
    [userId],
  );
  return result.rows[0] ? buildOAuthProfile(result.rows[0]) : null;
}

module.exports = {
  buildOAuthProfile,
  loadOAuthProfile,
};
