import React, { useState } from "react";
import { Loader2, Lock, Mail, Shield, User } from "lucide-react";

import type { RegisterResponseDto } from "../../../packages/contracts/src/index.ts";
import { useLocale } from "../../context/LocaleContext";
import { supabase } from "../../lib/supabase";
import { notify } from "../../services/system/notificationService";
import { getDefaultPresetAvatarId } from "../../utils/presetAvatars";
import { TurnstileWidget, useTurnstile } from "./TurnstileWidget";

interface RegisterFormProps {
  onSuccess?: (result: RegisterResponseDto) => void;
  onLoginClick?: () => void;
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
    error: turnstileError,
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
      const displayName = email.split("@")[0] || "New User";
      const defaultAvatarId = getDefaultPresetAvatarId(email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: formData.password,
        options: {
          data: {
            display_name: displayName,
            full_name: displayName,
            avatar_url: defaultAvatarId,
          },
          ...(turnstileToken ? { captchaToken: turnstileToken } : {}),
        },
      });

      if (error) {
        throw error;
      }

      const result: RegisterResponseDto = {
        userId: data.user?.id || "",
        email: data.user?.email || email,
        status: data.session ? "registered" : "verification_pending",
      };

      notify.success(
        pick("注册成功", "Registration successful"),
        data.session
          ? pick("账号已创建，正在进入系统。", "Your account was created and you are being signed in.")
          : pick("账号已创建，请前往邮箱完成验证。", "Your account was created. Please verify your email."),
      );
      onSuccess?.(result);
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
          {pick("加入 KK Studio，开始你的创作之旅", "Join KK Studio and start creating")}
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
          <p className="text-xs text-gray-500 mt-1">
            {pick(
              "请使用真实邮箱，后续验证和通知会依赖这个地址",
              "Use a real email address for verification and notifications.",
            )}
          </p>
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

        <div className="py-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {pick("安全验证", "Security verification")}
            </span>
          </div>
          <TurnstileWidget
            onVerify={handleVerify}
            onError={handleError}
            onExpire={handleExpire}
            theme="auto"
          />
          {turnstileError && (
            <p className="text-red-500 text-sm mt-2">{turnstileError}</p>
          )}
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {pick("我已阅读并同意", "I have read and agree to")}
            <a href="#" className="text-blue-600 hover:underline ml-1">
              {pick("用户协议", "Terms of Service")}
            </a>
            {pick("和", "and")}
            <a href="#" className="text-blue-600 hover:underline ml-1">
              {pick("隐私政策", "Privacy Policy")}
            </a>
          </span>
        </label>

        <button
          type="submit"
          disabled={isLoading || !isVerified}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {pick("注册中...", "Creating account...")}
            </>
          ) : (
            pick("立即注册", "Create account")
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
        {pick("已有账号？", "Already have an account?")}
        <button
          type="button"
          onClick={onLoginClick}
          className="text-blue-600 hover:underline font-medium ml-1"
        >
          {pick("立即登录", "Sign in")}
        </button>
      </p>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
        <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" />
          {pick("当前注册表单已对齐 Supabase 托管认证链路", "This form uses the Supabase hosted auth path")}
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;
