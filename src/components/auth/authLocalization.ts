import {
  localizeUserFacingText,
  pickByResolvedLanguage,
  type ResolvedLanguage,
} from "../../utils/localeText.ts";
import { HOSTED_PASSWORD_LOGIN_ROUTE_DISABLED_CODE } from "../../services/auth/passwordSignIn.ts";

export type AuthView = "login" | "register" | "forgot-password";

function pick(language: ResolvedLanguage, zh: string, en: string): string {
  return pickByResolvedLanguage(language, zh, en);
}

function isCaptchaErrorMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("captcha")
    || normalizedMessage.includes("turnstile")
    || normalizedMessage.includes("captcha_token")
    || normalizedMessage.includes("security purposes")
    || normalizedMessage.includes("robot")
  );
}

function extractErrorCode(error: unknown): string | null {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (Array.isArray(error)) {
    const firstCode = error.find((item) => typeof item === "string" && item.trim());
    return typeof firstCode === "string" ? firstCode.trim() : null;
  }

  return null;
}

export function getTurnstileMissingSiteKeyMessage(language: ResolvedLanguage): string {
  return pick(
    language,
    "当前部署未配置 Turnstile Site Key，请补齐 VITE_TURNSTILE_SITE_KEY 后再试。",
    "This deployment is missing the Turnstile site key. Add VITE_TURNSTILE_SITE_KEY and try again.",
  );
}

export function getTurnstileDisabledMessage(language: ResolvedLanguage): string {
  return pick(
    language,
    "当前部署关闭了 Turnstile，但后端仍然要求验证码，请检查风控配置。",
    "Turnstile is disabled in this deployment, but the server still requires CAPTCHA. Check the risk-control settings.",
  );
}

export function getCaptchaExpiredMessage(language: ResolvedLanguage): string {
  return pick(
    language,
    "人机验证已过期，请重新完成验证。",
    "CAPTCHA verification expired. Please complete it again.",
  );
}

export function getTurnstileStatusMessage(
  language: ResolvedLanguage,
  key:
    | "waiting"
    | "loadingScript"
    | "rendering"
    | "verified"
    | "expired"
    | "loaded"
    | "missingConfig"
    | "disabled",
): string {
  switch (key) {
    case "waiting":
      return pick(language, "等待加载 Turnstile", "Waiting for Turnstile");
    case "loadingScript":
      return pick(language, "正在加载 Turnstile 脚本", "Loading the Turnstile script");
    case "rendering":
      return pick(language, "正在渲染 Turnstile 组件", "Rendering the Turnstile widget");
    case "verified":
      return pick(language, "Turnstile 验证通过", "Turnstile verification complete");
    case "expired":
      return pick(language, "Turnstile 已过期，等待重新验证", "Turnstile expired. Waiting for re-verification");
    case "loaded":
      return pick(language, "Turnstile 组件已加载", "The Turnstile widget is ready");
    case "missingConfig":
      return pick(language, "Turnstile 未配置，请检查 VITE_TURNSTILE_SITE_KEY。", "Turnstile is not configured. Check VITE_TURNSTILE_SITE_KEY.");
    case "disabled":
      return pick(language, "Turnstile 已被本地环境变量禁用。", "Turnstile has been disabled by the local environment variables.");
    default:
      return "";
  }
}

export function mapTurnstileErrorMessage(language: ResolvedLanguage, error: unknown): string {
  const code = extractErrorCode(error);
  const normalizedCode = code?.toLowerCase();

  if (normalizedCode?.includes("failed to load turnstile script") || normalizedCode?.includes("timed out while waiting")) {
    return pick(
      language,
      "Turnstile 脚本加载失败，请检查浏览器是否拦截了 challenges.cloudflare.com。",
      "Failed to load the Turnstile script. Check whether the browser blocked challenges.cloudflare.com.",
    );
  }

  switch (code) {
    case "400020":
      return pick(
        language,
        "Cloudflare 返回 Invalid sitekey，请检查当前部署里的 Turnstile site key。",
        "Cloudflare returned Invalid sitekey. Check the Turnstile site key in this deployment.",
      );
    case "400070":
      return pick(
        language,
        "当前 Turnstile site key 已被禁用，请检查 Cloudflare widget 状态。",
        "The current Turnstile site key has been disabled. Check the widget status in Cloudflare.",
      );
    case "110200":
      return pick(
        language,
        "当前域名不在 Turnstile widget 的允许列表中，请补齐 Cloudflare 白名单。",
        "The current origin is not allowed by the Turnstile widget. Add the domain to the Cloudflare allowlist.",
      );
    case "200500":
      return pick(
        language,
        "Turnstile iframe 加载失败，请检查浏览器、代理或安全软件是否拦截了 Cloudflare。",
        "The Turnstile iframe failed to load. Check whether the browser, proxy, or security software blocked Cloudflare.",
      );
    default:
      return code
        ? pick(language, `Turnstile 加载失败（错误码：${code}）。`, `Turnstile failed to load (error code: ${code}).`)
        : pick(
          language,
          "Turnstile 脚本加载失败，请检查浏览器是否拦截了 challenges.cloudflare.com。",
          "Failed to load the Turnstile script. Check whether the browser blocked challenges.cloudflare.com.",
        );
  }
}

export function mapAuthErrorMessage(
  language: ResolvedLanguage,
  error: unknown,
  view: AuthView,
): string {
  const message = String((error as { message?: string }).message || "");

  if (isCaptchaErrorMessage(message)) {
    return pick(
      language,
      "当前请求需要先完成人机验证，请等待 Turnstile 验证完成后再试。",
      "This request requires CAPTCHA verification first. Wait for Turnstile to finish and try again.",
    );
  }

  if (message.includes("AUTH_ROUTE_DISABLED")) {
    if (view === "register") {
      return pick(
        language,
        "注册接口尚未在本地运行时接管，请等待后端认证链路补齐。",
        "The registration route is not ready in the local runtime yet. Wait for the backend auth flow to catch up.",
      );
    }

    return pick(
      language,
      "登录接口尚未在本地运行时接管，请等待后端认证链路补齐。",
      "The sign-in route is not ready in the local runtime yet. Wait for the backend auth flow to catch up.",
    );
  }

  if (message.includes("AUTH_RESET_PASSWORD_UNAVAILABLE")) {
    return pick(
      language,
      "当前本地运行时尚未接入重置密码接口。",
      "The local runtime does not expose password reset yet.",
    );
  }

  if (view === "register" && (message.includes("User already registered") || message.includes("already registered"))) {
    return pick(language, "该邮箱已注册，请直接登录。", "This email is already registered. Please sign in instead.");
  }

  if (view === "register" && message.includes("Database error saving new user")) {
    return pick(
      language,
      "注册配置异常，用户资料初始化失败，请联系管理员检查认证后端。",
      "Registration is misconfigured right now. Contact an administrator to inspect the auth backend.",
    );
  }

  if (message.includes("Invalid login credentials")) {
    return pick(language, "邮箱或密码错误。", "Incorrect email or password.");
  }

  if (message.includes("Email not confirmed")) {
    return pick(language, "请先完成邮箱验证后再登录。", "Please verify your email before signing in.");
  }

  if (message.includes("Password should be at least")) {
    return pick(language, "密码长度至少 6 位。", "Password must be at least 6 characters.");
  }

  if (message.includes("For security purposes")) {
    return pick(language, "操作过于频繁，请稍后再试。", "Too many attempts. Please try again later.");
  }

  if (message.includes(HOSTED_PASSWORD_LOGIN_ROUTE_DISABLED_CODE)) {
    return pick(
      language,
      "托管密码登录接口不可用，请检查 KK API 登录路由是否可用。",
      "The hosted password login route is unavailable. Check whether the KK API sign-in route is available.",
    );
  }

  return localizeUserFacingText(message) || message || pick(language, "操作失败，请重试。", "Action failed. Please try again.");
}

export function getWechatQrModalCopy(language: ResolvedLanguage) {
  return {
    badge: pick(language, "微信扫码", "WeChat QR"),
    expiresAt: (value: string) => pick(language, `二维码有效期至 ${value}`, `QR code expires at ${value}`),
    closeAria: pick(language, "关闭微信扫码弹窗", "Close WeChat QR dialog"),
    loading: pick(language, "正在生成微信扫码二维码...", "Generating a WeChat QR code..."),
    emptyState: pick(
      language,
      "暂时没有拿到微信二维码地址。请确认 KK API 已启动，或检查微信登录服务配置。",
      "No WeChat QR URL is available yet. Confirm that the KK API is running and that the WeChat sign-in service is configured correctly.",
    ),
    invalidUrlFallback: pick(
      language,
      "微信二维码链接无法识别，已切换到备用展示方式。",
      "The WeChat QR URL could not be parsed, so the dialog switched to the fallback view.",
    ),
    widgetRenderFallback: pick(
      language,
      "微信二维码组件未能正常渲染，已自动切换到备用展示方式。",
      "The WeChat QR widget did not render correctly, so the dialog switched to the fallback view automatically.",
    ),
    widgetLoadFallback: pick(
      language,
      "微信二维码组件加载失败，已自动切换到备用展示方式。",
      "The WeChat QR widget failed to load, so the dialog switched to the fallback view automatically.",
    ),
    loadingWidget: pick(language, "正在加载微信官方扫码组件...", "Loading the official WeChat QR widget..."),
    fallbackHelp: pick(
      language,
      "如果二维码区域没有正常显示，可以改用新页面打开。",
      "If the QR area does not render correctly, open it in a new page instead.",
    ),
    openInNewPage: pick(language, "在新页面打开", "Open in a new page"),
  };
}
