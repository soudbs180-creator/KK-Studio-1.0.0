// Authentication and session lifecycle routes.

const express = require('express');
// 该常量此前身兼两职：既做「本地单机档案的默认邮箱」，又做「按邮箱自动册封管理员」的判据。
// 后者带默认值是严重漏洞：注册接口不校验邮箱所有权，任何人抢注该邮箱即可自助提权。
// 现拆成两个：本地默认邮箱保留兜底；管理员引导判据未显式配置时为空，一律不提权（fail closed）。
const LOCAL_DEFAULT_EMAIL = process.env.ADMIN_INITIAL_EMAIL || '977483863@qq.com';
const INITIAL_ADMIN_EMAIL = String(process.env.ADMIN_INITIAL_EMAIL || '').trim().toLowerCase();

// 仅当显式配置了 ADMIN_INITIAL_EMAIL 且邮箱完全匹配时才允许引导册封。
function shouldBootstrapAdmin(email) {
  return Boolean(INITIAL_ADMIN_EMAIL) && String(email || '').trim().toLowerCase() === INITIAL_ADMIN_EMAIL;
}

const crypto = require('crypto');
const { getPool } = require('../../lib/db');
const { signJWT } = require('../../lib/jwt');
const {
  authErrorEnvelope,
  buildMeta,
  okEnvelope,
  verifyRequestJwt,
} = require('./shared/requestContext');

const router = express.Router();
const ACCESS_TOKEN_COOKIE_NAME = 'kk.api.access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'kk.api.refresh_token';
const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function getRequiredPasswordSalt() {
  if (!process.env.PASSWORD_SALT) {
    throw new Error('[严重] PASSWORD_SALT 未配置，拒绝处理密码凭据');
  }
  return process.env.PASSWORD_SALT;
}

function hashPassword(password) {
  return crypto.createHmac('sha256', getRequiredPasswordSalt()).update(password).digest('hex');
}

function timingSafeEqualHex(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'hex');
  const rightBuffer = Buffer.from(String(right || ''), 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function buildProfileFromUserRow(user) {
  const email = String(user.email || '').trim();
  const timestamp = user.updated_at || user.created_at || new Date().toISOString();
  const adminLevel = Number(user.admin_level || 0);
  return {
    id: user.id,
    email,
    nickname: email.split('@')[0] || 'KK User',
    avatarUrl: '',
    adminLevel,
    role: adminLevel > 0 ? 'admin' : 'user',
    status: 'active',
    createdAt: user.created_at || timestamp,
    updatedAt: timestamp,
  };
}

function buildLocalProfile(userId, email = (process.env.NODE_ENV === 'test' ? 'local-user@example.com' : LOCAL_DEFAULT_EMAIL)) {
  const now = new Date().toISOString();
  return {
    id: userId || 'local-user',
    email,
    nickname: email.split('@')[0] || 'Local User',
    avatarUrl: '',
    adminLevel: 1,
    role: 'admin',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

async function loadProfileForUserId(userId) {
  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    const defaultEmail = process.env.NODE_ENV === 'test' ? 'local-user@example.com' : LOCAL_DEFAULT_EMAIL;
    return buildLocalProfile(userId, defaultEmail);
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT id, email, created_at, updated_at, COALESCE(admin_level, 0) AS admin_level FROM public.users WHERE id = $1',
    [userId]
  );

  if (result.rows.length > 0) {
    const user = result.rows[0];
    if (shouldBootstrapAdmin(user.email) && Number(user.admin_level || 0) !== 1) {
      user.admin_level = 1;
      await pool.query('UPDATE public.users SET admin_level = 1, updated_at = NOW() WHERE id = $1', [user.id]);
      console.warn('[SECURITY] 已按 ADMIN_INITIAL_EMAIL 引导册封初始管理员', { userId: user.id });
    }
    return buildProfileFromUserRow(user);
  }
  return null;
}

function buildAuthSession(profile) {
  const accessToken = signJWT({ userId: profile.id });
  return {
    accessToken,
    refreshToken: signJWT({ userId: profile.id }),
    expiresIn: 7 * 24 * 60 * 60,
    sessionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    profile,
  };
}

function isHttpsRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || forwardedProto.split(',').map((part) => part.trim()).includes('https');
}

function buildAuthCookie(req, name, value, maxAgeSeconds) {
  const sameSiteSuffix = isHttpsRequest(req) ? 'SameSite=None; Secure' : 'SameSite=Lax';
  const encodedName = encodeURIComponent(name);
  const encodedValue = encodeURIComponent(value || '');
  return `${encodedName}=${encodedValue}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; ${sameSiteSuffix}`;
}

function setAuthSessionCookies(req, res, session) {
  res.setHeader('Set-Cookie', [
    buildAuthCookie(req, ACCESS_TOKEN_COOKIE_NAME, session.accessToken, AUTH_COOKIE_MAX_AGE_SECONDS),
    buildAuthCookie(req, REFRESH_TOKEN_COOKIE_NAME, session.refreshToken, AUTH_COOKIE_MAX_AGE_SECONDS),
  ]);
  res.setHeader('X-Refresh-Token', session.accessToken);
}

function clearAuthSessionCookies(req, res) {
  res.setHeader('Set-Cookie', [
    buildAuthCookie(req, ACCESS_TOKEN_COOKIE_NAME, '', 0),
    buildAuthCookie(req, REFRESH_TOKEN_COOKIE_NAME, '', 0),
  ]);
}

function sendAuthSession(req, res, profile) {
  const session = buildAuthSession(profile);
  setAuthSessionCookies(req, res, session);
  return res.json(okEnvelope(session, req));
}


async function resolveAuthenticatedProfile(req, res, tokenOverride = '') {
  const userId = verifyRequestJwt(req, tokenOverride);
  if (!userId) {
    res.status(401).json(authErrorEnvelope(req, 'AUTH_REQUIRED', 'Authentication is required.'));
    return null;
  }

  const profile = await loadProfileForUserId(userId);
  if (!profile) {
    res.status(401).json(authErrorEnvelope(req, 'AUTH_USER_NOT_FOUND', 'User not found.'));
    return null;
  }

  res.setHeader('X-Refresh-Token', signJWT({ userId }));
  return profile;
}

router.get('/v1/auth/session', async (req, res) => {
  const profile = await resolveAuthenticatedProfile(req, res);
  if (!profile) {
    return;
  }

  return sendAuthSession(req, res, profile);
});

router.get('/v1/auth/token', async (req, res) => {
  const profile = await resolveAuthenticatedProfile(req, res);
  if (!profile) {
    return;
  }

  const accessToken = signJWT({ userId: profile.id });
  return res.json({
    jwt: accessToken,
    user: {
      id: profile.id,
      email: profile.email,
    },
  });
});

router.post('/v1/auth/refresh', async (req, res) => {
  const profile = await resolveAuthenticatedProfile(req, res, req.body?.refreshToken);
  if (!profile) {
    return;
  }

  return sendAuthSession(req, res, profile);
});

router.post('/v1/auth/logout', async (req, res) => {
  clearAuthSessionCookies(req, res);
  return res.json(okEnvelope({ loggedOut: true }, req));
});


// 简体中文注释：常规登录接口，优先使用数据库校验凭据，调试环境无数据库时提供 Mock 登录
router.post('/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_INVALID_PAYLOAD',
        message: 'Email and password are required.'
      },
      meta: buildMeta(req)
    });
  }

  const isNoDb = !process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true';
  if (isNoDb) {
    const isTest = process.env.NODE_ENV === 'test';
    if (!isTest && String(password).trim() !== 'admin123456') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid login credentials (Mock password must be admin123456).'
        },
        meta: buildMeta(req)
      });
    }

    const userId = 'mock-user-id';
    const defaultEmail = isTest ? 'local-user@example.com' : LOCAL_DEFAULT_EMAIL;
    const loginEmail = String(email).trim() || defaultEmail;
    const session = buildAuthSession({
      id: userId,
      email: loginEmail,
      nickname: loginEmail.split('@')[0] || 'Mock User',
      avatarUrl: '',
      adminLevel: 1,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setAuthSessionCookies(req, res, session);
    return res.json({
      success: true,
      data: session,
      meta: buildMeta(req)
    });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, email, password_hash, COALESCE(admin_level, 0) AS admin_level, created_at FROM public.users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid login credentials.'
        },
        meta: buildMeta(req)
      });
    }

    const user = result.rows[0];
    const computedHash = hashPassword(password);

    // 简体中文注释：密码哈希必须使用时序安全比较，避免登录接口暴露可测量的差异。
    if (!timingSafeEqualHex(user.password_hash, computedHash)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid login credentials.'
        },
        meta: buildMeta(req)
      });
    }

    let adminLevel = Number(user.admin_level || 0);
    if (shouldBootstrapAdmin(user.email) && adminLevel !== 1) {
      adminLevel = 1;
      await pool.query('UPDATE public.users SET admin_level = 1, updated_at = NOW() WHERE id = $1', [user.id]);
      console.warn('[SECURITY] 已按 ADMIN_INITIAL_EMAIL 引导册封初始管理员', { userId: user.id });
    }

    const session = buildAuthSession({
      id: user.id,
      email: user.email,
      nickname: user.email.split('@')[0],
      avatarUrl: '',
      adminLevel: adminLevel,
      role: adminLevel > 0 ? 'admin' : 'user',
      status: 'active',
      createdAt: user.created_at,
      updatedAt: new Date().toISOString()
    });
    setAuthSessionCookies(req, res, session);
    return res.json({
      success: true,
      data: session,
      meta: buildMeta(req)
    });
  } catch (err) {
    console.error('[auth] Login failed:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during login.'
      },
      meta: buildMeta(req)
    });
  }
});

const PASSWORD_RESET_ACCEPTED_MESSAGE = 'If an account exists for this email, password reset instructions will be sent shortly.';
const PASSWORD_RESET_COMPLETED_MESSAGE = 'Password has been reset. You can sign in with the new password.';
const PASSWORD_RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildPasswordResetRequestResponse(email) {
  return {
    requested: true,
    email,
    delivery: 'email',
    status: 'accepted',
    message: PASSWORD_RESET_ACCEPTED_MESSAGE
  };
}

function getPasswordResetTokenSecret() {
  return process.env.PASSWORD_RESET_TOKEN_SECRET || getRequiredPasswordSalt();
}

function hashPasswordResetToken(token) {
  return crypto.createHmac('sha256', getPasswordResetTokenSecret()).update(String(token || '')).digest('hex');
}

function createPasswordResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function getRequestIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwardedFor || req.socket?.remoteAddress || '';
}

function getPublicAppOrigin(req) {
  const configured = process.env.PUBLIC_APP_URL || process.env.KK_PUBLIC_APP_URL || process.env.WEB_PUBLIC_URL || '';
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0]?.trim();
  const host = forwardedHost || req.headers.host || 'localhost:3000';
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0]?.trim();
  const protocol = forwardedProto || (isHttpsRequest(req) ? 'https' : 'http');
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function buildPasswordResetUrl(req, token) {
  const url = new URL(getPublicAppOrigin(req));
  url.searchParams.set('auth-mode', 'reset-password');
  url.searchParams.set('token', token);
  return url.toString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendPasswordResetEmail(email, resetUrl) {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const from = process.env.PASSWORD_RESET_EMAIL_FROM || '';
  if (!resendApiKey || !from || typeof fetch !== 'function') {
    return { queued: false, reason: 'mail_provider_not_configured' };
  }

  const safeResetUrl = escapeHtml(resetUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your KK Studio password',
      text: `Use this link to reset your KK Studio password. The link expires in ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes.\n\n${resetUrl}`,
      html: `<p>Use this link to reset your KK Studio password. The link expires in ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes.</p><p><a href="${safeResetUrl}">Reset password</a></p>`
    })
  });

  if (!response.ok) {
    throw new Error(`password reset email provider returned HTTP ${response.status}`);
  }

  return { queued: true };
}

// privacy-preserving: never reveal whether the submitted email belongs to an existing account.
async function handlePasswordResetRequest(req, res) {
  const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_INVALID_EMAIL',
        message: 'Enter a valid email address.'
      },
      meta: buildMeta(req)
    });
  }

  const data = buildPasswordResetRequestResponse(normalizedEmail);
  const isNoDb = !process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true';

  if (!isNoDb) {
    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT id, email FROM public.users WHERE email = $1 LIMIT 1',
        [normalizedEmail]
      );
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const rawToken = createPasswordResetToken();
        const tokenHash = hashPasswordResetToken(rawToken);
        const expiresAt = new Date(Date.now() + Math.max(5, PASSWORD_RESET_TOKEN_TTL_MINUTES) * 60 * 1000).toISOString();
        await pool.query(
          'UPDATE public.password_reset_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',
          [user.id]
        );
        await pool.query(
          'INSERT INTO public.password_reset_tokens (id, user_id, email, token_hash, expires_at, request_ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
            user.id,
            user.email,
            tokenHash,
            expiresAt,
            getRequestIp(req),
            String(req.headers['user-agent'] || '').slice(0, 500)
          ]
        );
        await sendPasswordResetEmail(user.email, buildPasswordResetUrl(req, rawToken));
      }
      console.info('[auth] Password reset request accepted.');
    } catch (err) {
      console.error('[auth] Password reset request lookup failed:', err?.message || err);
    }
  }

  return res.json({
    success: true,
    data: {
      ...data,
      code: 'AUTH_PASSWORD_RESET_REQUESTED'
    },
    meta: buildMeta(req)
  });
}

async function handlePasswordResetConfirm(req, res) {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  if (!token || token.length < 24) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_INVALID_RESET_TOKEN',
        message: 'Password reset token is invalid or expired.'
      },
      meta: buildMeta(req)
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_WEAK_PASSWORD',
        message: 'Password must be at least 8 characters.'
      },
      meta: buildMeta(req)
    });
  }

  if (!process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true') {
    return res.status(503).json({
      success: false,
      error: {
        code: 'AUTH_PASSWORD_RESET_UNAVAILABLE',
        message: 'Password reset confirmation requires the hosted database runtime.'
      },
      meta: buildMeta(req)
    });
  }

  const tokenHash = hashPasswordResetToken(token);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tokenResult = await client.query(
      'SELECT id, user_id, expires_at, consumed_at FROM public.password_reset_tokens WHERE token_hash = $1 LIMIT 1 FOR UPDATE',
      [tokenHash]
    );
    const tokenRow = tokenResult.rows[0];
    const tokenExpired = !tokenRow || tokenRow.consumed_at || new Date(tokenRow.expires_at).getTime() <= Date.now();
    if (tokenExpired) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_RESET_TOKEN',
          message: 'Password reset token is invalid or expired.'
        },
        meta: buildMeta(req)
      });
    }

    await client.query(
      'UPDATE public.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashPassword(newPassword), tokenRow.user_id]
    );
    await client.query(
      'UPDATE public.password_reset_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',
      [tokenRow.user_id]
    );
    await client.query('COMMIT');
    return res.json({
      success: true,
      data: {
        updated: true,
        status: 'completed',
        code: 'AUTH_PASSWORD_RESET_COMPLETED',
        message: PASSWORD_RESET_COMPLETED_MESSAGE
      },
      meta: buildMeta(req)
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[auth] Password reset confirmation failed:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during password reset.'
      },
      meta: buildMeta(req)
    });
  } finally {
    client.release();
  }
}

router.post('/v1/auth/password-reset/request', handlePasswordResetRequest);
router.post('/auth/password-reset/request', handlePasswordResetRequest);
router.post('/v1/auth/password-reset/confirm', handlePasswordResetConfirm);
router.post('/auth/password-reset/confirm', handlePasswordResetConfirm);

// 简体中文注释：常规注册接口，优先注册到数据库，默认写入 0 积分，调试环境直接返回 Mock 成功
router.post('/v1/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_INVALID_PAYLOAD',
        message: 'Email and password are required.'
      },
      meta: buildMeta(req)
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'AUTH_WEAK_PASSWORD',
        message: 'Password must be at least 8 characters.'
      },
      meta: buildMeta(req)
    });
  }

  const isNoDb = !process.env.DATABASE_URL || process.env.KKAI_LOCAL_ONLY === 'true';
  if (isNoDb) {
    return res.json({
      success: true,
      data: {
        userId: 'mock-user-id',
        email: email.trim(),
        status: 'registered'
      },
      meta: buildMeta(req)
    });
  }

  try {
    const pool = getPool();
    const existing = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTH_USER_ALREADY_EXISTS',
          message: 'User already exists.'
        },
        meta: buildMeta(req)
      });
    }

    const userId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password);

    // 默认积分一律为 0，符合 AGENTS.md 安全审计要求
    await pool.query(
      'INSERT INTO public.users (id, email, password_hash, credits, created_at, updated_at) VALUES ($1, $2, $3, 0, NOW(), NOW())',
      [userId, email.trim().toLowerCase(), passwordHash]
    );

    return res.json({
      success: true,
      data: {
        userId,
        email: email.trim().toLowerCase(),
        status: 'registered'
      },
      meta: buildMeta(req)
    });
  } catch (err) {
    console.error('[auth] Register failed:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during registration.'
      },
      meta: buildMeta(req)
    });
  }
});


module.exports = router;
