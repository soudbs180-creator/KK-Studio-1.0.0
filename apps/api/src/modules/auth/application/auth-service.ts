import type {
  AuthActionResultDto,
  LoginRequestDto,
  LoginResponseDto,
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

export interface TurnstileVerifier {
  (token: string, ip?: string): Promise<{ success: boolean; error?: string }>;
}

export interface AuthServiceDependencies {
  verifyTurnstileToken: TurnstileVerifier;
  rateLimiter?: InMemoryRateLimiter;
  identityStore?: AuthIdentityStore;
  passwordChangeCodeEmailSender?: PasswordChangeCodeEmailSender;
}

export interface AuthRequestContext {
  ip: string;
}

export interface AuthHandlerResult<T = AuthActionResultDto> {
  statusCode: number;
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
  try {
    return new FileBackedAuthIdentityStore();
  } catch {
    return new InMemoryAuthIdentityStore();
  }
}

export class AuthService {
  private readonly verifyTurnstileToken: TurnstileVerifier;
  private readonly rateLimiter: InMemoryRateLimiter;
  private readonly identityStore: AuthIdentityStore;
  private readonly passwordChangeCodeEmailSender: PasswordChangeCodeEmailSender;
  private readonly logger = consoleLogger.child({ module: "auth" });

  constructor(dependencies: AuthServiceDependencies) {
    this.verifyTurnstileToken = dependencies.verifyTurnstileToken;
    this.rateLimiter = dependencies.rateLimiter || new InMemoryRateLimiter();
    this.identityStore = dependencies.identityStore || createDefaultIdentityStore();
    this.passwordChangeCodeEmailSender = dependencies.passwordChangeCodeEmailSender || createPasswordChangeCodeEmailSenderFromEnv();
  }

  async register(
    input: RegisterRequestDto,
    context: AuthRequestContext,
  ): Promise<AuthHandlerResult<RegisterResponseDto>> {
    if (!input.email || !input.password || !input.turnstileToken) {
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

    const turnstileResult = await this.verifyTurnstileToken(input.turnstileToken, context.ip);
    if (!turnstileResult.success) {
      return this.forbidden(turnstileResult.error || "Turnstile verification failed.");
    }

    const registered = this.identityStore.registerPasswordUser(
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

    const session = this.identityStore.authenticatePassword(
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
      "Verification-code login is not available on the API service. Use the hosted Supabase auth flow instead.",
    );
  }

  async sendPasswordChangeCode(
    headers: Record<string, string>,
  ): Promise<AuthHandlerResult<SendPasswordChangeCodeResponseDto>> {
    const profile = this.getProfile(headers);
    if (!profile?.email) {
      return this.unauthorized("Authentication is required before sending a password change code.");
    }

    if (!this.rateLimiter.consume("password-change-code", profile.email, passwordChangeCodeRule)) {
      return this.rateLimited("Too many password change code requests for this email.");
    }

    const issued = this.identityStore.issuePasswordChangeCode(profile.id);
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

  updatePassword(
    headers: Record<string, string>,
    input: UpdatePasswordRequestDto,
  ): UpdatePasswordResponseDto | undefined {
    const profile = this.getProfile(headers);
    if (!profile || !input.newPassword?.trim()) {
      return undefined;
    }

    const normalizedCurrentPassword = String(input.currentPassword || "").trim();
    const normalizedVerificationCode = String(input.verificationCode || "").trim();
    const updatedProfile = normalizedCurrentPassword
      ? this.identityStore.changePassword(profile.id, normalizedCurrentPassword, input.newPassword)
      : normalizedVerificationCode
        ? (
          this.rateLimiter.consume("password-change-verify", profile.id, passwordChangeVerifyRule)
            ? this.identityStore.changePasswordWithCode(profile.id, normalizedVerificationCode, input.newPassword)
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

  private success<T>(statusCode: number, data: T): AuthHandlerResult<T> {
    return {
      statusCode,
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

  private unauthorized<T>(error: string): AuthHandlerResult<T> {
    return {
      statusCode: 401,
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
}
