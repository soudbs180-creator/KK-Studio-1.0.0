export const HTTP_HEADERS = {
  authorization: "Authorization",
  requestId: "X-Request-Id",
  clientVersion: "X-Client-Version",
  internalService: "X-Internal-Service",
  internalToken: "X-Internal-Token",
} as const;

export const HTTP_CONTENT_TYPES = {
  json: "application/json; charset=utf-8",
} as const;
