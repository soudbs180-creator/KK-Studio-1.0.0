// 职责：管理员积分调整面板，提供基于用户邮箱的手动积分调整表单（可正可负）
// 路由：子面板，嵌入在 AdminLayout 中
// 鉴权：使用管理员 token 调用接口

import React, { useState } from "react";
import { adminAdjustCredits, adminGetUsers } from "../../services/api/adminPanelApi.ts";
import { getStoredKkApiAccessToken } from "../../services/api/authAccessToken.ts";
import { Sliders, Mail, Edit3 } from "lucide-react";

export const CreditsPanel: React.FC = () => {
  // 声明状态变量，全部使用英文命名，中文注释
  const [email, setEmail] = useState(""); // 目标用户邮箱
  const [delta, setDelta] = useState<number>(0); // 积分变动值 (正数加，负数减)
  const [note, setNote] = useState(""); // 变动备注
  const [loading, setLoading] = useState(false); // 加载状态
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null); // 反馈消息

  // 提交调分申请
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email.trim()) {
      setMessage({ type: "error", text: "请输入用户邮箱" });
      return;
    }
    if (delta === 0) {
      setMessage({ type: "error", text: "积分调整值不能为 0" });
      return;
    }
    if (delta < -100000 || delta > 100000) {
      setMessage({ type: "error", text: "单次积分变动必须在 -100,000 到 100,000 之间" });
      return;
    }
    if (!note.trim()) {
      setMessage({ type: "error", text: "必须填写积分调整原因备注" });
      return;
    }

    setLoading(true);
    const token = getStoredKkApiAccessToken() || "";

    try {
      // 1. 先通过邮箱模糊查询用户ID
      const userListRes = await adminGetUsers({ page: 1, limit: 1, search: email.trim() }, token);
      const targetUser = userListRes.users.find(
        (u: any) => u.email.toLowerCase() === email.trim().toLowerCase()
      );

      if (!targetUser) {
        setMessage({ type: "error", text: "未找到该邮箱对应的用户" });
        setLoading(false);
        return;
      }

      // 2. 调分接口
      const result = await adminAdjustCredits(targetUser.id, delta, note, token);

      setMessage({
        type: "success",
        text: `调整成功！用户 ${targetUser.email} 积分变动了 ${delta > 0 ? "+" : ""}${delta}，当前最新余额为 ${result.newBalance}。`,
      });
      // 清空表单
      setEmail("");
      setDelta(0);
      setNote("");
    } catch (err: any) {
      console.error("[管理员调分失败]", err);
      setMessage({
        type: "error",
        text: err.message || "积分调整失败，请重试",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111827]/80 border border-[#1F293D] rounded-2xl p-6 w-full h-full backdrop-blur-md shadow-2xl">
      <div className="border-b border-[#1F293D] pb-3 mb-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sliders className="text-purple-500" size={18} />
          积分手动调整
        </h2>
        <p className="text-xs text-gray-400 mt-1">管理员可在此手动扣减或加赠用户的积分，任何变动都会录入审计日志。</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-gray-300 mb-1.5">
            用户邮箱
          </label>
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-[#1F293D] text-white placeholder-gray-500 border border-[#374151] rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
            <Mail className="absolute left-3 top-2.5 text-gray-500" size={14} />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-gray-300 mb-1.5">
            积分变动值 (输入正数加积分，负数扣积分)
          </label>
          <input
            type="number"
            value={delta || ""}
            onChange={(e) => setDelta(parseInt(e.target.value, 10) || 0)}
            placeholder="例如: 50 或 -50"
            className="w-full bg-[#1F293D] text-white border border-[#374151] rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-gray-300 mb-1.5">
            调整原因备注 (必填)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：排查报错人工赠送"
            className="w-full bg-[#1F293D] text-white placeholder-gray-500 border border-[#374151] rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl ${
              message.type === "success"
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-all shadow-[0_4px_12px_rgba(168,85,247,0.2)] hover:shadow-[0_4px_20px_rgba(168,85,247,0.3)] hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Edit3 size={14} />
          {loading ? "正在处理..." : "确认调整"}
        </button>
      </form>
    </div>
  );
};
