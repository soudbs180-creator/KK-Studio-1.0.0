// netlify/lib/response.ts
// 职责：定义后端统一响应头 (包括 Content-Type、CORS 跨域请求头)；
// 提供一致的成功及英文错误响应封装方法。

export const COMMON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * 快速生成标准 JSON 响应
 * @param statusCode HTTP 状态码
 * @param body 响应主体数据对象
 */
export function makeResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: COMMON_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * 生成脱敏的英文错误响应，保障安全性且防乱码
 * @param statusCode HTTP 状态码
 * @param englishMessage 英文错误描述
 */
export function makeErrorResponse(statusCode: number, englishMessage: string) {
  return makeResponse(statusCode, { error: englishMessage });
}
