import React, { useState } from "react";
import { Loader2, Lock, Mail, Shield, User } from "lucide-react";

import type { RegisterResponseDto } from "../../../packages/contracts/src/dto/auth.ts";
import { legacyWebApiClient } from "../../services/api/kkApiClient";
import { notify } from "../../services/system/notificationService";
import { useLocale } from "../../context/LocaleContext";
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
      notify.error("信息不完整", "请填写邮箱和密码。");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      notify.error("邮箱格式错误", "请输入有效的邮箱地址。");
      return false;
    }

    if (formData.password.length < 8) {
      notify.error("密码过短", "密码长度至少需要 8 位。");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      notify.error("两次密码不一致", "请确认两次输入的密码一致。");
      return false;
    }

    if (!isVerified || !turnstileToken) {
      notify.error("验证未完成", "请先完成人机验证。");
      return false;
    }

    if (!agreed) {
      notify.error("请先同意协议", "继续注册前需要先同意用户协议和隐私政策。");
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

    const response = await legacyWebApiClient.register({
      email: formData.email,
      password: formData.password,
      turnstileToken: turnstileToken || "",
    });

    if (response.success) {
      notify.success("注册成功", "账号已创建，请继续完成后续验证流程。");
      onSuccess?.(response.data);
      setIsLoading(false);
      return;
    }

    notify.error("注册失败", response.error.message);
    resetTurnstile();
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
          <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">创建账号</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          加入 KK Studio，开始你的创作之旅
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            邮箱地址
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
            请使用真实邮箱，后续验证和通知会依赖这个地址
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            密码
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="至少 8 位字符"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            确认密码
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="再次输入密码"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              required
            />
          </div>
        </div>

        <div className="py-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">安全验证</span>
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
            我已阅读并同意
            <a href="#" className="text-blue-600 hover:underline ml-1">用户协议</a>
            和
            <a href="#" className="text-blue-600 hover:underline ml-1">隐私政策</a>
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
              注册中...
            </>
          ) : (
            "立即注册"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
        已有账号？
        <button
          type="button"
          onClick={onLoginClick}
          className="text-blue-600 hover:underline font-medium ml-1"
        >
          立即登录
        </button>
      </p>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
        <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" />
          当前注册表单已切换到版本化认证接口
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;
