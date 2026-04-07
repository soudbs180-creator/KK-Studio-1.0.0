import type {
  AuthActionResultDto,
  LoginRequestDto,
  LoginResponseDto,
  ProfileDto,
  RegisterRequestDto,
  SendCodeRequestDto,
  UpdateProfileRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import { validateAuthEmail } from "../domain/email-policy.ts";
import { InMemoryAuthIdentityStore } from "../infrastructure/in-memory-auth-identity-store.ts";
import { InMemoryRateLimiter, type RateLimitRule } from "../infrastructure/in-memory-rate-limiter.ts";

export interface TurnstileVerifier {
  (token: string, ip?: string): Promise<{ success: boolean; error?: string }>;
}

export interface AuthServiceDependencies {
  verifyTurnstileToken: TurnstileVerifier;
  rateLimiter?: InMemoryRateLimiter;
  identityStore?: InMemoryAuthIdentityStore;
}

export interface AuthRequestContext {
  ip: string;
}

export interface AuthHandlerResult {
  statusCode: number;
  body: {
    success: boolean;
    message?: string;
    error?: string;
    data?: AuthActionResultDto;
  };
}

const registerIpRule: RateLimitRule = { max: 10, windowMs: 60 * 60 * 1000 };
const registerEmailRule: RateLimitRule = { max: 3, windowMs: 60 * 60 * 1000 };
const loginIpRule: RateLimitRule = { max: 20, windowMs: 60 * 60 * 1000 };
const sendCodeRule: RateLimitRule = { max: 3, windowMs: 60 * 60 * 1000 };

export class AuthService {
  private readonly verifyTurnstileToken: TurnstileVerifier;
  private readonly rateLimiter: InMemoryRateLimiter;
  private readonly identityStore: InMemoryAuthIdentityStore;
  private readonly logger = consoleLogger.child({ module: "auth" });

  constructor(dependencies: AuthServiceDependencies) {
    this.verifyTurnstileToken = dependencies.verifyTurnstileToken;
    this.rateLimiter = dependencies.rateLimiter || new InMemoryRateLimiter();
    this.identityStore = dependencies.identityStore || new InMemoryAuthIdentityStore();
  }

  async register(input: RegisterRequestDto, context: AuthRequestContext): Promise<AuthHandlerResult> {
    if (!input.email || !input.password || !input.turnstileToken) {
      return this.badRequest("Missing required fields: email, password, turnstileToken.");
    }

    const emailCheck = validateAuthEmail(input.email);
    if (emailCheck.ok === false) {
      return this.badRequest(emailCheck.error);
    }

    const turnstileResult = await this.verifyTurnstileToken(input.turnstileToken, context.ip);
    if (!turnstileResult.success) {
      return this.forbidden(turnstileResult.error || "Turnstile verification failed.");
    }

    if (!this.rateLimiter.consume("register-ip", context.ip, registerIpRule)) {
      return this.rateLimited("Too many register attempts from this IP.");
    }

    if (!this.rateLimiter.consume("register-email", emailCheck.normalizedEmail, registerEmailRule)) {
      return this.rateLimited("Too many register attempts for this email.");
    }

    this.logger.info("Register request validated by the migrated auth module", {
      email: emailCheck.normalizedEmail,
      ip: context.ip,
    });

    this.logger.warn("Register request rejected because password auth is disabled on the API service", {
      email: emailCheck.normalizedEmail,
      ip: context.ip,
    });

    return this.routeDisabled(
      "Password registration is not available on /api/v1/auth/register. Use the hosted Supabase auth flow instead.",
    );
  }

  async login(input: LoginRequestDto, context: AuthRequestContext): Promise<AuthHandlerResult> {
    if (!input.email || !input.password) {
      return this.badRequest("Missing required fields: email, password.");
    }

    const emailCheck = validateAuthEmail(input.email);
    if (emailCheck.ok === false) {
      return this.badRequest(emailCheck.error);
    }

    if (input.turnstileToken) {
      const turnstileResult = await this.verifyTurnstileToken(input.turnstileToken, context.ip);
      if (!turnstileResult.success) {
        return this.forbidden(turnstileResult.error || "Turnstile verification failed.");
      }
    }

    if (!this.rateLimiter.consume("login-ip", context.ip, loginIpRule)) {
      return this.rateLimited("Too many login attempts from this IP.");
    }

    this.logger.info("Login request validated by the migrated auth module", {
      email: emailCheck.normalizedEmail,
      ip: context.ip,
    });

    this.logger.warn("Login request rejected because password auth is disabled on the API service", {
      email: emailCheck.normalizedEmail,
      ip: context.ip,
    });

    return this.routeDisabled(
      "Password login is not available on /api/v1/auth/login. Use the hosted Supabase auth flow instead.",
    );
  }

  async sendCode(input: SendCodeRequestDto, context: AuthRequestContext): Promise<AuthHandlerResult> {
    if (!input.email || !input.turnstileToken) {
      return this.badRequest("Missing required fields: email, turnstileToken.");
    }

    const emailCheck = validateAuthEmail(input.email);
    if (emailCheck.ok === false) {
      return this.badRequest(emailCheck.error);
    }

    const turnstileResult = await this.verifyTurnstileToken(input.turnstileToken, context.ip);
    if (!turnstileResult.success) {
      return this.forbidden(turnstileResult.error || "Turnstile verification failed.");
    }

    if (!this.rateLimiter.consume("send-code", emailCheck.normalizedEmail, sendCodeRule)) {
      return this.rateLimited("Too many send-code attempts for this email.");
    }

    this.logger.info("Send-code request validated by the migrated auth module", {
      email: emailCheck.normalizedEmail,
      ip: context.ip,
    });

    this.logger.warn("Send-code request rejected because password auth is disabled on the API service", {
      email: emailCheck.normalizedEmail,
      ip: context.ip,
    });

    return this.routeDisabled(
      "Verification-code login is not available on the API service. Use the hosted Supabase auth flow instead.",
    );
  }

  registerProfile(email: string): { created: boolean; profile: ProfileDto } {
    return this.identityStore.createRegisteredUser(email);
  }

  issueLoginSession(email: string): LoginResponseDto {
    return this.identityStore.issueLoginSession(email);
  }

  resolveAccessToken(accessToken: string): ProfileDto | undefined {
    return this.identityStore.resolveAccessToken(accessToken);
  }

  getProfile(headers: Record<string, string>): ProfileDto | undefined {
    return this.identityStore.resolveProfile(headers);
  }

  updateProfile(headers: Record<string, string>, input: UpdateProfileRequestDto): ProfileDto | undefined {
    return this.identityStore.updateProfile(headers, input);
  }

  private badRequest(error: string): AuthHandlerResult {
    return {
      statusCode: 400,
      body: {
        success: false,
        error,
      },
    };
  }

  private forbidden(error: string): AuthHandlerResult {
    return {
      statusCode: 403,
      body: {
        success: false,
        error,
      },
    };
  }

  private rateLimited(error: string): AuthHandlerResult {
    return {
      statusCode: 429,
      body: {
        success: false,
        error,
      },
    };
  }

  private routeDisabled(error: string): AuthHandlerResult {
    return {
      statusCode: 501,
      body: {
        success: false,
        error,
      },
    };
  }
}
