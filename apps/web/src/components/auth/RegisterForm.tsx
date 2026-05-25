import React, { useState } from "react";
import { Loader2, Lock, Mail, User } from "lucide-react";

import type { RegisterResponseDto } from "../../../packages/contracts/src/index.ts";
import { useLocale } from "../../context/LocaleContext";
import { kkWebApiClient } from "../../services/api/kkApiClient";
import { notify } from "../../services/system/notificationService";
import { TurnstileWidget, useTurnstile } from "./TurnstileWidget";

interface RegisterFormProps {
  onSuccess?: (result: RegisterResponseDto) => void;
  onLoginClick?: () => void;
}

function buildAuthErrorMessage(code: string | undefined, fallback: string): string {
  const normalizedCode = String(code || "").trim();

  if (normalizedCode === "AUTH_ROUTE_DISABLED" || normalizedCode === "HTTP_404" || normalizedCode === "HTTP_405") {
    return "当前本地运行时的注册接口尚未接管，请等待后端认证链路补齐。";
  }

  return fallback;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onLoginClick,
}) => {
  const { pick } = useLocale();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const {
    token: turnstileToken,
    isVerified,
    handleVerify,
    handleError,
    handleExpire,
    reset: resetTurnstile,
  } = useTurnstile();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      notify.error(
        pick("信息不完整", "Incomplete form"),
        pick("请填写邮箱和密码。", "Please enter your email and password."),
      );
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      notify.error(
        pick("邮箱格式错误", "Invalid email"),
        pick("请输入有效的邮箱地址。", "Please enter a valid email address."),
      );
      return false;
    }

    if (formData.password.length < 8) {
      notify.error(
        pick("密码过短", "Password too short"),
        pick("密码长度至少需要 8 位。", "Password must be at least 8 characters."),
      );
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      notify.error(
        pick("两次密码不一致", "Passwords do not match"),
        pick("请确认两次输入的密码一致。", "Please make sure both passwords match."),
      );
      return false;
    }

    if (!isVerified || !turnstileToken) {
      notify.error(
        pick("验证未完成", "Verification required"),
        pick("请先完成人机验证。", "Please complete the captcha verification first."),
      );
      return false;
    }

    if (!agreed) {
      notify.error(
        pick("请先同意协议", "Agreement required"),
        pick("继续注册前请先同意用户协议和隐私政策。", "Please agree to the terms before registering."),
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const email = formData.email.trim();
      const response = await kkWebApiClient.register({
        email,
        password: formData.password,
        turnstileToken: turnstileToken || "",
      });

      if (!response.success) {
        throw new Error(buildAuthErrorMessage(
          response.error.code,
          response.error.message || "Registration failed.",
        ));
      }

      notify.success(
        pick("注册请求已提交", "Registration request submitted"),
        response.data.status === "verification_pending"
          ? pick(
            "当前后端认证链路尚未完全接管，请等待服务器开放验证流程。",
            "The backend auth flow has not fully taken over yet. Wait for the server to open the verification flow.",
          )
          : pick("账号信息已创建，请继续登录。", "Your account record was created. Continue to sign in."),
      );

      onSuccess?.(response.data);
      onLoginClick?.();
      setIsLoading(false);
      return;
    } catch (error: any) {
      notify.error(
        pick("注册失败", "Registration failed"),
        error?.message || pick("注册失败，请稍后重试。", "Registration failed. Please try again."),
      );
      resetTurnstile();
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
          <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {pick("创建账号", "Create account")}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {pick("注册入口已切换到 KK API，本地运行时会在后端未就绪时明确提示。", "The sign-up flow now goes through the KK API and will tell you clearly if the backend is not ready.")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {pick("邮箱地址", "Email address")}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={pick("请输入邮箱地址", "Enter your email")}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {pick("密码", "Password")}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={pick("至少 8 位字符", "At least 8 characters")}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {pick("确认密码", "Confirm password")}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder={pick("再次输入密码", "Enter password again")}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              required
            />
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 p-3">
          <TurnstileWidget
            onVerify={handleVerify}
            onError={handleError}
            onExpire={handleExpire}
            appearance="always"
            action="register"
            className="min-h-[70px]"
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1"
          />
          <span>
            {pick("我已阅读并同意用户协议与隐私政策", "I agree to the terms and privacy policy")}
          </span>
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-70"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pick("提交注册请求", "Submit registration request")}
        </button>
      </form>
    </div>
  );
};
