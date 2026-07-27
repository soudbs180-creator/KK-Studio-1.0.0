const express = require('express');
const { getPool } = require('../../lib/db');
const {
  readProviderConfig,
  resolveSafeRedirectTo,
  resolveStateTtlSeconds,
} = require('../../lib/oauth/oauthConfig');
const { resolveOAuthAccount } = require('../../lib/oauth/oauthAccountService');
const { asOAuthFlowError, OAuthFlowError } = require('../../lib/oauth/oauthError');
const { loadOAuthProfile } = require('../../lib/oauth/oauthProfile');
const {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
} = require('../../lib/oauth/oauthProviders');
const {
  consumeOAuthStateCookie,
  setOAuthSessionCookies,
  setOAuthStateCookie,
} = require('../../lib/oauth/oauthSession');
const {
  consumeOAuthTransaction,
  createOAuthTransaction,
} = require('../../lib/oauth/oauthStateStore');
const {
  authErrorEnvelope,
  okEnvelope,
  verifyRequestJwt,
} = require('./shared/requestContext');

function readQueryValue(value) {
  return Array.isArray(value) ? String(value[0] || '').trim() : String(value || '').trim();
}

function ensureHostedOAuthRuntime(env) {
  if (!env.DATABASE_URL || env.KKAI_LOCAL_ONLY === 'true') {
    throw new OAuthFlowError(
      'OAUTH_HOSTED_RUNTIME_REQUIRED',
      '第三方登录仅在已连接数据库的托管服务中可用。',
      503,
    );
  }
}

function buildCallbackRedirect(transaction, provider, outcome) {
  const redirectUrl = new URL(transaction.redirect_to);
  redirectUrl.searchParams.set('provider', provider);
  redirectUrl.searchParams.set('auth', outcome.success ? 'success' : 'error');
  if (transaction.mode === 'bind') {
    redirectUrl.searchParams.set('mode', `${provider}-bind`);
  }
  if (!outcome.success) {
    redirectUrl.searchParams.set('error', outcome.error.code);
    redirectUrl.searchParams.set('error_description', outcome.error.message);
  }
  return redirectUrl.toString();
}

function sendStartError(req, res, error) {
  const oauthError = asOAuthFlowError(error);
  return res
    .status(oauthError.status)
    .json(authErrorEnvelope(req, oauthError.code, oauthError.message));
}

function createStartHandler(provider, mode, dependencies) {
  return async (req, res) => {
    try {
      const env = dependencies.env();
      ensureHostedOAuthRuntime(env);
      const userId = mode === 'bind' ? verifyRequestJwt(req) : null;
      if (mode === 'bind' && !userId) {
        throw new OAuthFlowError('AUTH_REQUIRED', '绑定第三方账号前请先登录。', 401);
      }

      const config = readProviderConfig(provider, env);
      const redirectTo = resolveSafeRedirectTo(readQueryValue(req.query.redirectTo), provider, env);
      const transaction = await createOAuthTransaction(dependencies.getPool(), {
        provider,
        mode,
        redirectTo,
        userId,
        ttlSeconds: resolveStateTtlSeconds(env),
      });
      setOAuthStateCookie(
        req,
        res,
        provider,
        transaction.state,
        resolveStateTtlSeconds(env),
      );
      return res.json(okEnvelope({
        provider,
        mode,
        authorizationUrl: buildAuthorizationUrl(provider, config, transaction.state),
        callbackUrl: config.redirectUri,
        state: transaction.state,
        expiresAt: transaction.expiresAt,
      }, req));
    } catch (error) {
      return sendStartError(req, res, error);
    }
  };
}

async function consumeCallbackTransaction(req, res, provider, dependencies) {
  const state = readQueryValue(req.query.state);
  if (!consumeOAuthStateCookie(req, res, provider, state)) {
    res.status(400).json(authErrorEnvelope(
      req,
      'OAUTH_BROWSER_STATE_MISMATCH',
      '登录请求与当前浏览器不匹配，请重新发起登录。',
    ));
    return null;
  }
  const transaction = await consumeOAuthTransaction(dependencies.getPool(), provider, state);
  if (!transaction) {
    res.status(400).json(authErrorEnvelope(
      req,
      'OAUTH_STATE_INVALID',
      '登录状态已失效或已被使用，请重新发起登录。',
    ));
    return null;
  }
  return transaction;
}

function assertBindSessionOwner(req, transaction) {
  if (transaction.mode !== 'bind') {
    return;
  }

  const currentUserId = verifyRequestJwt(req);
  if (!currentUserId || currentUserId !== transaction.user_id) {
    throw new OAuthFlowError(
      'OAUTH_BIND_SESSION_MISMATCH',
      '当前登录账号已变化，请重新登录后发起绑定。',
      401,
    );
  }
}

function redirectCallbackFailure(res, transaction, provider, error) {
  const oauthError = asOAuthFlowError(error);
  return res.redirect(302, buildCallbackRedirect(transaction, provider, {
    success: false,
    error: oauthError,
  }));
}

function createCallbackHandler(provider, dependencies) {
  return async (req, res) => {
    let transaction;
    try {
      const env = dependencies.env();
      ensureHostedOAuthRuntime(env);
      transaction = await consumeCallbackTransaction(req, res, provider, dependencies);
      if (!transaction) return undefined;
      assertBindSessionOwner(req, transaction);

      if (readQueryValue(req.query.error)) {
        return redirectCallbackFailure(res, transaction, provider, new OAuthFlowError(
          'OAUTH_ACCESS_DENIED',
          '你取消了第三方登录授权。',
          400,
        ));
      }
      const code = readQueryValue(req.query.code);
      if (!code || code.length > 2048) {
        throw new OAuthFlowError('OAUTH_CODE_INVALID', '第三方登录未返回有效授权码。', 400);
      }

      const config = readProviderConfig(provider, env);
      const identity = await exchangeAuthorizationCode(
        provider,
        dependencies.fetchImpl(),
        config,
        code,
      );
      const pool = dependencies.getPool();
      const userId = await resolveOAuthAccount(pool, identity, transaction.mode, transaction.user_id);
      const profile = await loadOAuthProfile(pool, userId);
      if (!profile) {
        throw new OAuthFlowError('AUTH_USER_NOT_FOUND', '登录账号创建失败。', 500);
      }

      setOAuthSessionCookies(req, res, userId);
      return res.redirect(302, buildCallbackRedirect(transaction, provider, { success: true }));
    } catch (error) {
      const oauthError = asOAuthFlowError(error);
      console.error('[oauth] 回调处理失败', { provider, code: oauthError.code });
      if (transaction) {
        return redirectCallbackFailure(res, transaction, provider, oauthError);
      }
      return res.status(oauthError.status).json(
        authErrorEnvelope(req, oauthError.code, oauthError.message),
      );
    }
  };
}

function createOAuthRouter(overrides = {}) {
  const router = express.Router();
  const dependencies = {
    env: overrides.env || (() => process.env),
    fetchImpl: overrides.fetchImpl || (() => globalThis.fetch),
    getPool: overrides.getPool || getPool,
  };

  for (const provider of ['google', 'wechat']) {
    router.get(`/v1/auth/${provider}/start`, createStartHandler(provider, 'login', dependencies));
    router.get(`/v1/auth/${provider}/bind/start`, createStartHandler(provider, 'bind', dependencies));
    router.get(`/v1/auth/${provider}/callback`, createCallbackHandler(provider, dependencies));
  }
  return router;
}

module.exports = createOAuthRouter();
module.exports.createOAuthRouter = createOAuthRouter;
