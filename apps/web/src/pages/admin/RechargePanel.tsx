// 职责：管理员充值管理面板，提供基于用户邮箱的积分直接充值表单
// 路由：子面板，嵌入在 AdminLayout 中
// 鉴权：使用管理员 token 调用接口

import React, { useState } from "react";
import { adminRechargeUser, adminGetUsers } from "@nano-banana/api-client";
import { getStoredKkApiAccessToken } from "../../services/api/authAccessToken.ts";

export const RechargePanel: React.FC = () => {
  // 声明状态变量，全部使用英文命名，中文注释
  const [email, setEmail] = useState(""); // 目标用户邮箱
  const [amount, setAmount] = useState<number>(100); // 充值积分额度
  const [note, setNote] = useState(""); // 操作备注
  const [loading, setLoading] = useState(false); // 加载状态
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null); // 反馈消息

  // 提交充值表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // 基础入参格式校验
    if (!email.trim()) {
      setMessage({ type: "error", text: "请输入用户邮箱" });
      return;
    }
    if (amount <= 0 || amount > 100000) {
      setMessage({ type: "error", text: "充值积分必须在 1 到 100,000 之间" });
      return;
    }

    setLoading(true);
    const token = getStoredKkApiAccessToken() || "";

    try {
      // 先模糊或精确查询用户（后端支持 users 接口，在此我们假设后端根据邮箱充值）
      // 等等，后端 recharge 路由为 /api/admin/users/:id/recharge
      // 所以我们需要先通过邮箱查询到用户的 ID。
      // 为此，我们调用 adminGetUsers 接口，匹配出精准匹配该邮箱 of user.id。
      const userListRes = await adminGetUsers({ page: 1, limit: 1, search: email.trim() }, token);
      
      const targetUser = userListRes.users.find(
        (u: any) => u.email.toLowerCase() === email.trim().toLowerCase()
      );

      if (!targetUser) {
        setMessage({ type: "error", text: "未找到该邮箱对应的用户" });
        setLoading(false);
        return;
      }

      // 执行充值
      await adminRechargeUser(targetUser.id, amount, note, token);

      setMessage({
        type: "success",
        text: `充值成功！已为用户 ${targetUser.email} 充值 ${amount} 积分。`,
      });
      // 充值成功后清空表单
      setEmail("");
      setAmount(100);
      setNote("");
    } catch (err: any) {
      console.error("[管理员充值失败]", err);
      setMessage({
        type: "error",
        text: err.message || "充值失败，请检查操作权限并重试",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900">充值管理</h2>
      <p className="text-sm text-gray-500 mt-1">管理员可在此向用户直接追加充值积分。</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            用户邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            充值积分额度
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
            min="1"
            max="100000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            充值备注 (选填)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：线上充值成功补发"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
          />
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150 disabled:opacity-50"
        >
          {loading ? "正在处理..." : "确认充值"}
        </button>
      </form>
    </div>
  );
};
