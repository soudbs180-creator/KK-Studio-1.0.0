import type {
  AuthActionResultDto,
  AuthSessionDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  ProfileDto,
  RegisterRequestDto,
  RegisterResponseDto,
  SendPasswordChangeCodeResponseDto,
  SendCodeRequestDto,
  UpdatePasswordRequestDto,
  UpdatePasswordResponseDto,
  UpdateProfileRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import { validateAuthEmail } from "../domain/email-policy.ts";
import { DEFAULT_SESSION_COOKIE_NAME } from "../domain/browser-session.ts";
import { FileBackedAuthIdentityStore } from "../infrastructure/file-auth-identity-store.ts";
import {
  type AuthIdentityStore,
  InMemoryAuthIdentityStore,
} from "../infrastructure/in-memory-auth-identity-store.ts";
import { InMemoryRateLimiter, type RateLimitRule } from "../infrastructure/in-memory-rate-limiter.ts";
import {
  createPasswordChangeCodeEmailSenderFromEnv,
  type PasswordChangeCodeEmailSender,
} from "../infrastructure/password-change-code-email-sender.ts";
import { createPostgresAuthIdentityStoreFromEnv } from "../infrastructure/postgres-auth-identity-store.ts";
import type { BrowserSessionService } from "./browser-session-service.ts";

export interface TurnstileVerifier {
  (token: string, ip?: string): Promise<{ success: boolean; error?: string }>;
}

export interface AuthServiceDependencies {
  verifyTurnstileToken: TurnstileVerifier;
  rateLimiter?: InMemoryRateLimiter;
  identityStore?: AuthIdentityStore;
  passwordChangeCodeEmailSender?: PasswordChangeCodeEmailSender;
  browserSessionService?: BrowserSessionService;
}

export interface AuthRequestContext {
  ip: string;
  userAgent?: string;
}

export interface AuthHandlerResult<T = AuthActionResultDto> {
  statusCode: number;
  headers?: Record<string, string | string[]>;
  body: {
    success: boolean;
    message?: string;
    error?: string;
    data?: T;
  };
}

const registerIpRule: RateLimitRule = { max: 10, windowMs: 60 * 60 * 1000 };
const registerEmailRule: RateLimitRule = { max: 3, windowMs: 60 * 60 * 1000 };
const loginIpRule: RateLimitRule = { max: 20, windowMs: 60 * 60 * 1000 };
const sendCodeRule: RateLimitRule = { max: 3, windowMs: 60 * 60 * 1000 };
const passwordChangeCodeRule: RateLimitRule = { max: 3, windowMs: 15 * 60 * 1000 };
const passwordChangeVerifyRule: RateLimitRule = { max: 5, windowMs: 15 * 60 * 1000 };

function createDefaultIdentityStore(): AuthIdentityStore {
  const postgresStore = createPostgresAuthIdentityStoreFromEnv();
  if (postgresStore) {
    return postgresStore;
  }

  try {
    return new FileBackedAuthIdentityStore();
  } catch {
    return new InMemoryAuthIdentityStore();
  }
}

function isTruthyEnvValue(value: string | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1"
    || normalized === "true"
    || normalized === "yes"
    || normalized === "on";
}

function isFalsyEnvValue(value: string | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "0"
    || normalized === "false"
    || normalized === "no"
    || normalized === "off";
}

function isTurnstileRequirementDisabled(): boolean {
  return isFalsyEnvValue(process.env.KK_AUTH_REQUIRE_TURNSTILE);
}

function isLocalTurnstileBypassActive(): boolean {
  return isTruthyEnvValue(process.env.KKAI_LOCAL_ONLY)
    && isTruthyEnvValue(process.env.VITE_TURNSTILE_LOCAL_BYPASS);
}

export class AuthService {
  private readonly verifyTurnstileToken: TurnstileVerifier;
  private readonly rateLimiter: InMemoryRateLimiter;
  private readonly identityStore: AuthIdentityStore;
  private readonly passwordChangeCodeEmailSender: PasswordChangeCodeEmailSender;
  private readonly browserSessionService?: BrowserSessionService;
  private readonly logger = consoleLogger.child({ module: "auth" });

  constructor(dependencies: AuthServiceDependencies) {
    this.verifyTurnstileToken = dependencies.verifyTurnstileToken;
    this.rateLimiter = dependencies.rateLimiter || new InMemoryRateLimiter();
    this.identityStore = dependencies.identityStore || createDefaultIdentityStore();
    this.passwordChangeCodeEmailSender = dependencies.passwordChangeCodeEmailSender || createPasswordChangeCodeEmailSenderFromEnv();
    this.browserSessionService = dependencies.browserSessionService;
  }

  async register(
    input: RegisterRequestDto,
    context: AuthRequestContext,
  ): Promise<AuthHandlerResult<RegisterResponseDto>> {
    const requireTurnstileToken = !isTurnstileRequirementDisabled() && !isLocalTurnstileBypassActive();

    if (!input.email || !input.password || (requireTurnstileToken && !input.turnstileToken)) {
      return this.badRequest("Missing required fields: email, password, turnstileToken.");
    }

    const emailCheck = validateAuthEmail(input.email);
    if (emailCheck.ok === false) {
      return this.badRequest(emailCheck.error);
    }

    if (!this.rateLimiter.consume("register-ip", context.ip, registerIpRule)) {
      return this.rateLimited("Too many register attempts from this IP.");
    }

    if (!this.rateLimiter.consume("register-email", emailCheck.normalizedEmail, registerEmailRule)) {
      return this.rateLimited("Too many register attempts for this email.");
    }

    if (input.turnstileToken || requireTurnstileToken) {
      const turnstileResult = await this.verifyTurnstileToken(input.turnstileToken || "", context.ip);
      if (!turnstileResult.success) {
        return this.forbidden(turnstileResult.error || "Turnstile verification failed.");
      }
    }

    const registered = await this.identityStore.registerPasswordUser(
      emailCheck.normalizedEmail,
      input.password,
    );
    if (!registered.created) {
      return this.conflict("An account already exists for this email.");
    }

    this.logger.info("Local password user registered via auth module", {
      email: registered.profile.email,
      ip: context.ip,
    });

    return this.success(201, {
      userId: registered.profile.id,
      email: registered.profile.email,
      status: "registered",
    });
  }

  async login(
    input: LoginRequestDto,
    context: AuthRequestContext,
  ): Promise<AuthHandlerResult<LoginResponseDto>> {
    const requireTurnstileToken = !isTurnstileRequirementDisabled() && !isLocalTurnstileBypassActive();

    if (!input.email || !input.password || (requireTurnstileToken && !input.turnstileToken)) {
      return this.badRequest("Missing required fields: email, password, turnstileToken.");
    }

    const emailCheck = validateAuthEmail(input.email);
    if (emailCheck.ok === false) {
      return this.badRequest(emailCheck.error);
    }

    if (input.turnstileToken || requireTurnstileToken) {
      const turnstileResult = await this.verifyTurnstileToken(input.turnstileToken || "", context.ip);
      if (!turnstileResult.success) {
        return this.forbidden(turnstileResult.error || "Turnstile verification failed.");
      }
    }

    if (!this.rateLimiter.consume("login-ip", context.ip, loginIpRule)) {
      return this.rateLimited("Too many login attempts from this IP.");
    }

    const session = await this.identityStore.authenticatePassword(
      emailCheck.normalizedEmail,
      input.password,
    );
    if (!session) {
      return this.unauthorized("Invalid email or password.");
    }

    this.logger.info("Local password login succeeded via auth module", {
      email: session.profile.email,
      ip: context.ip,
    });

    if (this.browserSessionService) {
      const browserSession = await this.browserSessionService.issueSession({
        userId: session.profile.id,
        email: session.profile.email,
        role: session.profile.role,
      }, {
        ip: context.ip,
        userAgent: context.userAgent,
      });

      return this.success(200, {
        accessToken: browserSession.accessToken,
        expiresIn: browserSession.expiresIn,
        sessionExpiresAt: browserSession.sessionExpiresAt,
        profile: session.profile,
      }, {
        "set-cookie": browserSession.setCookie,
      });
    }

    return this.success(200, session);
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

    return this.routeDisabled(
      "Verification-code login is not available on the API service. Use the VPS-backed session login flow instead.",
    );
  }

  async sendPasswordChangeCode(
    headers: Record<string, string>,
  ): Promise<AuthHandlerResult<SendPasswordChangeCodeResponseDto>> {
    const profile = await this.getProfile(headers);
    if (!profile?.email) {
      return this.unauthorized("Authentication is required before sending a password change code.");
    }

    if (!this.rateLimiter.consume("password-change-code", profile.email, passwordChangeCodeRule)) {
      return this.rateLimited("Too many password change code requests for this email.");
    }

    const issued = await this.identityStore.issuePasswordChangeCode(profile.id);
    if (!issued) {
      return this.unauthorized("Authentication is required before sending a password change code.");
    }

    await this.passwordChangeCodeEmailSender.sendPasswordChangeCode({
      userId: profile.id,
      email: profile.email,
      code: issued.code,
      expiresAt: issued.expiresAt,
    });

    this.logger.info("Password change verification code issued via auth module", {
      email: profile.email,
      expiresAt: issued.expiresAt,
    });

    return this.success(200, {
      sent: true,
      email: profile.email,
      expiresAt: issued.expiresAt,
    });
  }

  async registerProfile(email: string): Promise<{ created: boolean; profile: ProfileDto }> {
    return await this.identityStore.createRegisteredUser(email);
  }

  async issueLoginSession(email: string): Promise<LoginResponseDto> {
    return await this.identityStore.issueLoginSession(email);
  }

  async resolveAccessToken(accessToken: string): Promise<ProfileDto | undefined> {
    return await this.identityStore.resolveAccessToken(accessToken);
  }

  async getProfile(headers: Record<string, string>): Promise<ProfileDto | undefined> {
    return await this.identityStore.resolveProfile(headers);
  }

  async updateProfile(
    headers: Record<string, string>,
    input: UpdateProfileRequestDto,
  ): Promise<ProfileDto | undefined> {
    return await this.identityStore.updateProfile(headers, input);
  }

  async updatePassword(
    headers: Record<string, string>,
    input: UpdatePasswordRequestDto,
  ): Promise<UpdatePasswordResponseDto | undefined> {
    const profile = await this.getProfile(headers);
    if (!profile || !input.newPassword?.trim()) {
      return undefined;
    }

    const normalizedCurrentPassword = String(input.currentPassword || "").trim();
    const normalizedVerificationCode = String(input.verificationCode || "").trim();
    const updatedProfile = normalizedCurrentPassword
      ? await this.identityStore.changePassword(profile.id, normalizedCurrentPassword, input.newPassword)
      : normalizedVerificationCode
        ? (
          this.rateLimiter.consume("password-change-verify", profile.id, passwordChangeVerifyRule)
            ? await this.identityStore.changePasswordWithCode(profile.id, normalizedVerificationCode, input.newPassword)
            : undefined
        )
        : undefined;
    if (!updatedProfile) {
      return undefined;
    }

    return {
      updated: true,
      profile: updatedProfile,
    };
  }

  async getSession(
    _headers: Record<string, string>,
    cookies: Record<string, string>,
    _context: AuthRequestContext,
  ): Promise<AuthHandlerResult<AuthSessionDto>> {
    if (!this.browserSessionService) {
      return this.routeDisabled("Browser-session auth is not enabled on this runtime.");
    }

    const refreshToken = String(cookies[this.getBrowserSessionCookieName()] || "").trim();
    if (!refreshToken) {
      return this.unauthorized("Authentication is required before restoring a browser session.");
    }

    try {
      const session = await this.browserSessionService.resolveSession(refreshToken);
      const profile = await this.identityStore.resolveAccessToken(session.accessToken);
      if (!profile) {
        return this.unauthorized(
          "Authentication is required before restoring a browser session.",
          {
            "set-cookie": this.browserSessionService.buildClearedSessionCookie(),
          },
        );
      }

      return this.success(200, {
        accessToken: session.accessToken,
        expiresIn: session.expiresIn,
        sessionExpiresAt: session.sessionExpiresAt,
        profile,
      });
    } catch {
      return this.unauthorized(
        "Authentication is required before restoring a browser session.",
        {
          "set-cookie": this.browserSessionService.buildClearedSessionCookie(),
        },
      );
    }
  }

  async refreshSession(
    _headers: Record<string, string>,
    cookies: Record<string, string>,
    context: AuthRequestContext,
  ): Promise<AuthHandlerResult<AuthSessionDto>> {
    if (!this.browserSessionService) {
      return this.routeDisabled("Browser-session auth is not enabled on this runtime.");
    }

    const refreshToken = String(cookies[this.getBrowserSessionCookieName()] || "").trim();
    if (!refreshToken) {
      return this.unauthorized("Authentication is required before refreshing a browser session.");
    }

    try {
      const session = await this.browserSessionService.rotateSession(refreshToken, {
        ip: context.ip,
        userAgent: context.userAgent,
      });
      const profile = await this.identityStore.resolveAccessToken(session.accessToken);
      if (!profile) {
        return this.unauthorized(
          "Authentication is required before refreshing a browser session.",
          {
            "set-cookie": this.browserSessionService.buildClearedSessionCookie(),
          },
        );
      }

      return this.success(200, {
        accessToken: session.accessToken,
        expiresIn: session.expiresIn,
        sessionExpiresAt: session.sessionExpiresAt,
        profile,
      }, {
        "set-cookie": session.setCookie,
      });
    } catch {
      return this.unauthorized(
        "Authentication is required before refreshing a browser session.",
        {
          "set-cookie": this.browserSessionService.buildClearedSessionCookie(),
        },
      );
    }
  }

  async logoutSession(
    _headers: Record<string, string>,
    cookies: Record<string, string>,
  ): Promise<AuthHandlerResult<LogoutResponseDto>> {
    if (this.browserSessionService) {
      const refreshToken = String(cookies[this.getBrowserSessionCookieName()] || "").trim();
      if (refreshToken) {
        await this.browserSessionService.revokeSession(refreshToken);
      }

      return this.success(200, {
        loggedOut: true,
      }, {
        "set-cookie": this.browserSessionService.buildClearedSessionCookie(),
      });
    }

    return this.success(200, {
      loggedOut: true,
    });
  }

  private success<T>(
    statusCode: number,
    data: T,
    headers?: Record<string, string | string[]>,
  ): AuthHandlerResult<T> {
    return {
      statusCode,
      ...(headers ? { headers } : {}),
      body: {
        success: true,
        data,
      },
    };
  }

  private badRequest<T>(error: string): AuthHandlerResult<T> {
    return {
      statusCode: 400,
      body: {
        success: false,
        error,
      },
    };
  }

  private forbidden<T>(error: string): AuthHandlerResult<T> {
    return {
      statusCode: 403,
      body: {
        success: false,
        error,
      },
    };
  }

  private unauthorized<T>(
    error: string,
    headers?: Record<string, string | string[]>,
  ): AuthHandlerResult<T> {
    return {
      statusCode: 401,
      ...(headers ? { headers } : {}),
      body: {
        success: false,
        error,
      },
    };
  }

  private conflict<T>(error: string): AuthHandlerResult<T> {
    return {
      statusCode: 409,
      body: {
        success: false,
        error,
      },
    };
  }

  private rateLimited<T>(error: string): AuthHandlerResult<T> {
    return {
      statusCode: 429,
      body: {
        success: false,
        error,
      },
    };
  }

  private routeDisabled<T>(error: string): AuthHandlerResult<T> {
    return {
      statusCode: 501,
      body: {
        success: false,
        error,
      },
    };
  }

  private getBrowserSessionCookieName(): string {
    const configuredName = String(process.env.KK_SESSION_COOKIE_NAME || "").trim();
    return configuredName || DEFAULT_SESSION_COOKIE_NAME;
  }
}
