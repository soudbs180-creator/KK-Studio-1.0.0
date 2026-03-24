import { mountLegacyAuthRoutes } from "../apps/api/src/modules/auth/index.ts";
import { verifyTurnstileToken } from "./turnstile_routes.ts";

export function mountAuthRoutes(app: any) {
  mountLegacyAuthRoutes(app, {
    verifyTurnstileToken,
  });
}
