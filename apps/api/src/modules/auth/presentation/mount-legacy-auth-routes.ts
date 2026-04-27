import type { LoginRequestDto, RegisterRequestDto, SendCodeRequestDto } from "../../../../../../packages/contracts/src/index.ts";
import { AuthService, type TurnstileVerifier } from "../application/auth-service.ts";

interface LegacyApp {
  post(path: string, handler: (req: any, res: any) => Promise<void> | void): void;
}

function getRequestIp(req: any): string {
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function buildLegacyAuthDisabledResponse() {
  return {
    success: false,
    error: "Legacy password auth routes are disabled. Use the VPS-backed session auth flow instead.",
  };
}

export function mountLegacyAuthRoutes(
  app: LegacyApp,
  options: {
    verifyTurnstileToken: TurnstileVerifier;
  },
) {
  const authService = new AuthService({
    verifyTurnstileToken: options.verifyTurnstileToken,
  });

  app.post("/api/auth/register", async (req: any, res: any) => {
    void (req.body as RegisterRequestDto);
    void authService;
    void getRequestIp(req);
    res.status(410).json(buildLegacyAuthDisabledResponse());
  });

  app.post("/api/auth/login", async (req: any, res: any) => {
    void (req.body as LoginRequestDto);
    void getRequestIp(req);
    res.status(410).json(buildLegacyAuthDisabledResponse());
  });

  app.post("/api/auth/send-code", async (req: any, res: any) => {
    void (req.body as SendCodeRequestDto);
    void getRequestIp(req);
    res.status(410).json(buildLegacyAuthDisabledResponse());
  });
}
