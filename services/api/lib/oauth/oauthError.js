class OAuthFlowError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'OAuthFlowError';
    this.code = code;
    this.status = status;
  }
}

function asOAuthFlowError(error) {
  if (error instanceof OAuthFlowError) {
    return error;
  }
  return new OAuthFlowError(
    'OAUTH_PROVIDER_REQUEST_FAILED',
    '第三方登录服务暂时不可用，请稍后重试。',
    502,
  );
}

module.exports = {
  OAuthFlowError,
  asOAuthFlowError,
};
