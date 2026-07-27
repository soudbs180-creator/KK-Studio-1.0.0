const crypto = require('crypto');
const { OAuthFlowError } = require('./oauthError');

async function findLinkedIdentity(client, identity) {
  const result = await client.query(
    `SELECT id, user_id
       FROM public.auth_identities
      WHERE provider = $1
        AND (
          ($4::varchar IS NOT NULL AND unionid = $4)
          OR (provider_app_id = $2 AND provider_subject = $3)
        )
      ORDER BY CASE WHEN unionid = $4 THEN 0 ELSE 1 END
      LIMIT 1
      FOR UPDATE`,
    [
      identity.provider,
      identity.providerAppId,
      identity.providerSubject,
      identity.unionId,
    ],
  );
  return result.rows[0] || null;
}

async function updateIdentityProfile(client, identityId, identity) {
  await client.query(
    `UPDATE public.auth_identities
        SET email = $2, email_verified = $3, openid = $4, unionid = $5,
            display_name = $6, avatar_url = $7, updated_at = NOW()
      WHERE id = $1`,
    [
      identityId,
      identity.email,
      identity.emailVerified,
      identity.openId,
      identity.unionId,
      identity.displayName,
      identity.avatarUrl,
    ],
  );
}

async function syncUserPresentation(client, userId, identity) {
  await client.query(
    `UPDATE public.users
        SET display_name = CASE WHEN COALESCE(display_name, '') = '' THEN $2 ELSE display_name END,
            avatar_url = CASE WHEN COALESCE(avatar_url, '') = '' THEN $3 ELSE avatar_url END,
            updated_at = NOW()
      WHERE id = $1`,
    [userId, identity.displayName, identity.avatarUrl],
  );
}

async function insertIdentity(client, userId, identity) {
  await client.query(
    `INSERT INTO public.auth_identities
      (id, user_id, provider, provider_app_id, provider_subject, email,
       email_verified, openid, unionid, display_name, avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      `identity-${crypto.randomUUID()}`,
      userId,
      identity.provider,
      identity.providerAppId,
      identity.providerSubject,
      identity.email,
      identity.emailVerified,
      identity.openId,
      identity.unionId,
      identity.displayName,
      identity.avatarUrl,
    ],
  );
}

async function createOAuthUser(client, identity) {
  if (identity.email && identity.emailVerified) {
    const emailOwner = await client.query(
      'SELECT id FROM public.users WHERE LOWER(email) = LOWER($1) LIMIT 1 FOR UPDATE',
      [identity.email],
    );
    if (emailOwner.rows.length > 0) {
      throw new OAuthFlowError(
        'OAUTH_ACCOUNT_EXISTS_REQUIRES_BIND',
        '该邮箱已注册，请先使用原账号登录，再绑定第三方登录。',
        409,
      );
    }
  }

  const userId = `oauth-${crypto.randomUUID()}`;
  await client.query(
    `INSERT INTO public.users
      (id, email, password_hash, credits, display_name, avatar_url, created_at, updated_at)
     VALUES ($1, $2, NULL, 0, $3, $4, NOW(), NOW())`,
    [userId, identity.email, identity.displayName, identity.avatarUrl],
  );
  await insertIdentity(client, userId, identity);
  return userId;
}

async function resolveAccountInsideTransaction(client, identity, mode, boundUserId) {
  const lockKey = identity.unionId
    ? `${identity.provider}:unionid:${identity.unionId}`
    : `${identity.provider}:${identity.providerAppId}:${identity.providerSubject}`;
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
  const linkedIdentity = await findLinkedIdentity(client, identity);

  if (mode === 'bind') {
    if (!boundUserId) {
      throw new OAuthFlowError('AUTH_REQUIRED', '绑定第三方账号前请先登录。', 401);
    }
    const userResult = await client.query('SELECT id FROM public.users WHERE id = $1 FOR UPDATE', [boundUserId]);
    if (userResult.rows.length === 0) {
      throw new OAuthFlowError('AUTH_USER_NOT_FOUND', '当前登录账号不存在。', 401);
    }
    if (linkedIdentity && linkedIdentity.user_id !== boundUserId) {
      throw new OAuthFlowError('OAUTH_IDENTITY_ALREADY_LINKED', '该第三方账号已绑定其他用户。', 409);
    }
    if (linkedIdentity) {
      await updateIdentityProfile(client, linkedIdentity.id, identity);
    } else {
      await insertIdentity(client, boundUserId, identity);
    }
    await syncUserPresentation(client, boundUserId, identity);
    return boundUserId;
  }

  if (linkedIdentity) {
    await updateIdentityProfile(client, linkedIdentity.id, identity);
    await syncUserPresentation(client, linkedIdentity.user_id, identity);
    return linkedIdentity.user_id;
  }
  return createOAuthUser(client, identity);
}

async function resolveOAuthAccount(pool, identity, mode, boundUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = await resolveAccountInsideTransaction(client, identity, mode, boundUserId);
    await client.query('COMMIT');
    return userId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  resolveOAuthAccount,
};
