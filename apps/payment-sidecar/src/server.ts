import http from "node:http";

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
  res.end(JSON.stringify(payload));
}

export function createPaymentSidecarApp() {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && requestUrl.pathname === "/healthz") {
      sendJson(res, 200, { ok: true, service: "kk-payment-sidecar" });
      return;
    }

    if (requestUrl.pathname === "/internal" || requestUrl.pathname.startsWith("/internal/")) {
      sendJson(res, 404, { error: "Internal payment route is not public." });
      return;
    }

    sendJson(res, 404, { error: "Payment sidecar endpoint not found." });
  });
}

export function createPaymentSidecarServer(
  port = Number(process.env.PAYMENT_SIDECAR_PORT || process.env.PORT || 3002),
) {
  const server = createPaymentSidecarApp();
  return server.listen(port, () => {
    console.log(`[payment-sidecar] 服务已启动，正在运行在端口 :${port}`);
  });
}
