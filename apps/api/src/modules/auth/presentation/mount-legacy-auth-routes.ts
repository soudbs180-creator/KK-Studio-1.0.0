import type { LoginRequestDto, RegisterRequestDto, SendCodeRequestDto } from "../../../../../../packages/contracts/src/index.ts";
import { AuthService, type TurnstileVerifier } from "../application/auth-service.ts";

interface LegacyApp {
  post(path: string, handler: (req: any, res: any) => Promise<void> | void): void;
}

function getRequestIp(req: any): string {
  return req.ip || req.connection?.remoteAddress || "unknown";
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
    const result = await authService.register(req.body as RegisterRequestDto, {
      ip: getRequestIp(req),
    });
    res.status(result.statusCode).json(result.body);
  });

  app.post("/api/auth/login", async (req: any, res: any) => {
    const result = await authService.login(req.body as LoginRequestDto, {
      ip: getRequestIp(req),
    });
    res.status(result.statusCode).json(result.body);
  });

  app.post("/api/auth/send-code", async (req: any, res: any) => {
    const result = await authService.sendCode(req.body as SendCodeRequestDto, {
      ip: getRequestIp(req),
    });
    res.status(result.statusCode).json(result.body);
  });
}
