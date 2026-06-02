// 职责：管理员用户检索与管理中心，支持展示用户注册头像、ID、邮箱、身份、类型与剩余积分，并提供快捷调分与充值操作。
// 路由：子面板，嵌入在 AdminLayout 中
// 鉴权：使用管理员 token 调用接口

import React, { useState, useEffect } from "react";
import { adminGetUsers, adminRechargeUser, adminAdjustCredits } from "@nano-banana/api-client";
import { getStoredKkApiAccessToken } from "../../services/api/authAccessToken.ts";
import { getDefaultPresetAvatarId, resolveAvatarUrl } from "../../utils/presetAvatars.ts";
import { Search, Coins, PlusCircle, ShieldAlert, Award, User, Clock, Copy, Check } from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  credits: number;
  adminLevel: number;
  createdAt: string;
}

export const UserManagementPanel: React.FC = () => {
  // 声明状态变量，全部使用英文命名，中文注释
  const [userList, setUserList] = useState<UserItem[]>([]); // 用户列表
  const [total, setTotal] = useState(0); // 总记录数
  const [page, setPage] = useState(1); // 当前页
  const [search, setSearch] = useState(""); // 搜索词
  const [loading, setLoading] = useState(false); // 加载状态
  
  // 快捷操作状态
  const [copiedId, setCopiedId] = useState<string | null>(null); // 已复制的用户 ID
  const [activeAction, setActiveAction] = useState<{ userId: string; email: string; type: "recharge" | "adjust" } | null>(null); // 当前正在操作的快捷气泡
  const [actionAmount, setActionAmount] = useState<number>(100); // 操作积分数量
  const [actionNote, setActionNote] = useState(""); // 操作原因
  const [actionLoading, setActionLoading] = useState(false); // 操作加载状态
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null); // 快捷操作反馈

  const token = getStoredKkApiAccessToken() || "";

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminGetUsers({ page, limit: 8, search: search.trim() }, token);
      if (res && Array.isArray(res.users)) {
        setUserList(res.users);
        setTotal(res.total || 0);
      }
    } catch (err) {
      console.error("[获取用户列表失败]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  // 复制用户 ID
  const handleCopyId = (id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // 提交快捷充值或积分调整
  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAction) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      if (activeAction.type === "recharge") {
        if (actionAmount <= 0 || actionAmount > 100000) {
          throw new Error("充值积分必须在 1 到 100,000 之间");
        }
        await adminRechargeUser(activeAction.userId, actionAmount, actionNote || "后台快捷充值", token);
        setActionMessage({
          type: "success",
          text: `充值成功！已为用户 ${activeAction.email} 充值 ${actionAmount} 积分。`,
        });
      } else {
        if (actionAmount === 0) {
          throw new Error("调分额度不能为 0");
        }
        if (actionAmount < -100000 || actionAmount > 100000) {
          throw new Error("单次变动额度必须在 -100,000 到 100,000 之间");
        }
        if (!actionNote.trim()) {
          throw new Error("必须填写调分原因备注");
        }
        const res = await adminAdjustCredits(activeAction.userId, actionAmount, actionNote, token);
        setActionMessage({
          type: "success",
          text: `调整成功！最新余额为 ${res.newBalance}。`,
        });
      }

      // 刷新数据并延迟关闭
      void fetchUsers();
      setTimeout(() => {
        setActiveAction(null);
        setActionAmount(100);
        setActionNote("");
        setActionMessage(null);
      }, 2000);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "操作失败，请重试",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 解析并渲染名字（从 email 中提取，临时用户则为临时）
  const getUserDisplayName = (user: UserItem) => {
    if (user.id.startsWith("temp-")) {
      return `临时用户-${user.id.slice(5, 11)}`;
    }
    return user.email.split("@")[0] || "未命名";
  };

  // 映射身份微章
  const getUserBadge = (user: UserItem) => {
    if (user.adminLevel === 1) {
      return (
        <span className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-full px-2.5 py-1 text-xs inline-flex items-center gap-1 font-semibold shadow-[0_0_10px_rgba(239,68,68,0.1)]">
          <ShieldAlert size={12} />
          高级管理员
        </span>
      );
    }
    if (user.adminLevel === 2) {
      return (
        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full px-2.5 py-1 text-xs inline-flex items-center gap-1 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
          <Award size={12} />
          普通管理员
        </span>
      );
    }
    if (user.credits >= 5000) {
      return (
        <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full px-2.5 py-1 text-xs inline-flex items-center gap-1 font-semibold shadow-[0_0_10px_rgba(245,158,11,0.1)]">
          <Coins size={12} />
          会员用户 (待定)
        </span>
      );
    }
    if (user.credits >= 1000) {
      return (
        <span className="bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full px-2.5 py-1 text-xs inline-flex items-center gap-1 font-semibold shadow-[0_0_10px_rgba(59,130,246,0.1)]">
          <Award size={12} />
          高级用户
        </span>
      );
    }
    return (
      <span className="bg-gray-500/10 border border-gray-500/20 text-gray-400 rounded-full px-2.5 py-1 text-xs inline-flex items-center gap-1">
        <User size={12} />
        普通用户
      </span>
    );
  };

  return (
    <div className="bg-[#111827]/80 border border-[#1F293D] rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1F293D] pb-5 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <User className="text-blue-500" size={20} />
            注册用户检索与管理
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            实时检索系统注册用户，监控剩余积分、身份与账号状态，支持内联一键快捷调分/充值。
          </p>
        </div>
        
        {/* 搜索框 */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索邮箱或用户ID..."
              className="bg-[#1F293D] text-white placeholder-gray-500 border border-[#374151] rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors w-64"
            />
            <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_4px_12px_rgba(59,130,246,0.2)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.3)] hover:-translate-y-0.5"
          >
            搜索
          </button>
        </form>
      </div>

      {/* 用户列表 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1F293D] text-gray-400 font-semibold">
              <th className="px-4 py-3.5">基本信息 / 头像</th>
              <th className="px-4 py-3.5">账号ID</th>
              <th className="px-4 py-3.5">用户类型</th>
              <th className="px-4 py-3.5">用户身份</th>
              <th className="px-4 py-3.5">剩余积分</th>
              <th className="px-4 py-3.5">注册时间</th>
              <th className="px-4 py-3.5 text-right">快捷运营</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F293D] text-gray-200">
            {loading && userList.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                    正在拉取用户数据...
                  </div>
                </td>
              </tr>
            ) : userList.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  暂无匹配的注册用户
                </td>
              </tr>
            ) : (
              userList.map((user) => {
                const avatarId = getDefaultPresetAvatarId(user.email || user.id);
                const avatarUrl = resolveAvatarUrl(avatarId);
                const isTemp = user.id.startsWith("temp-");
                
                return (
                  <tr key={user.id} className="hover:bg-[#1E293B]/40 transition-colors group">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#1F293D] border border-[#374151] flex-shrink-0 group-hover:border-blue-500 transition-colors relative">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-900/40 text-blue-400 font-bold text-sm">
                              {getUserDisplayName(user)[0]}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors truncate max-w-[150px]">
                            {getUserDisplayName(user)}
                          </div>
                          <div className="text-gray-400 text-xs truncate max-w-[180px]">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px] bg-[#1F293D]/30 border border-[#1F293D] rounded-lg px-2 py-1 w-fit">
                        <span className="truncate max-w-[100px]">{user.id}</span>
                        <button
                          onClick={() => handleCopyId(user.id)}
                          className="hover:text-white transition-colors"
                          title="复制ID"
                        >
                          {copiedId === user.id ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {isTemp ? (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg px-2 py-0.5 text-[11px]">
                          临时用户
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg px-2 py-0.5 text-[11px]">
                          正式用户
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">{getUserBadge(user)}</td>
                    <td className="px-4 py-3.5 font-mono text-sm text-yellow-400 font-bold">
                      {user.credits.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">分</span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setActiveAction({ userId: user.id, email: user.email, type: "recharge" });
                            setActionAmount(100);
                            setActionNote("");
                            setActionMessage(null);
                          }}
                          className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 rounded-xl px-2.5 py-1 transition-all text-xs font-semibold"
                        >
                          快捷充值
                        </button>
                        <button
                          onClick={() => {
                            setActiveAction({ userId: user.id, email: user.email, type: "adjust" });
                            setActionAmount(50);
                            setActionNote("");
                            setActionMessage(null);
                          }}
                          className="bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/20 rounded-xl px-2.5 py-1 transition-all text-xs font-semibold"
                        >
                          手动调分
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控制 */}
      {!loading && total > 8 && (
        <div className="mt-6 flex items-center justify-between border-t border-[#1F293D] pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-[#1F293D] hover:bg-[#374151] border border-[#374151] text-gray-300 disabled:opacity-30 rounded-xl px-3 py-1.5 transition-colors disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <span className="text-gray-400">
            第 {page} 页 / 共 {Math.ceil(total / 8)} 页
          </span>
          <button
            onClick={() => setPage((p) => (p * 8 < total ? p + 1 : p))}
            disabled={page * 8 >= total}
            className="bg-[#1F293D] hover:bg-[#374151] border border-[#374151] text-gray-300 disabled:opacity-30 rounded-xl px-3 py-1.5 transition-colors disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      )}

      {/* 快捷充值/调分悬浮弹窗 (Modal) */}
      {activeAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
              <Coins className={activeAction.type === "recharge" ? "text-blue-500" : "text-purple-500"} size={18} />
              {activeAction.type === "recharge" ? "快捷充值积分" : "微调积分余额"}
            </h3>
            <p className="text-xs text-gray-400 mb-4 break-all">
              正在操作用户：<span className="text-white font-medium">{activeAction.email}</span>
            </p>

            <form onSubmit={handleActionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {activeAction.type === "recharge" ? "充值积分数量" : "积分调整数值 (正数加分，负数扣分)"}
                </label>
                <input
                  type="number"
                  value={actionAmount || ""}
                  onChange={(e) => setActionAmount(parseInt(e.target.value, 10) || 0)}
                  placeholder={activeAction.type === "recharge" ? "例如: 100" : "例如: 50 或 -50"}
                  className="w-full bg-[#1F293D] text-white border border-[#374151] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  备注 / 原因 {activeAction.type === "adjust" && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="text"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={activeAction.type === "recharge" ? "例如：日常充值" : "例如：排查系统故障人工赠分"}
                  className="w-full bg-[#1F293D] text-white border border-[#374151] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  required={activeAction.type === "adjust"}
                />
              </div>

              {actionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    actionMessage.type === "success"
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {actionMessage.text}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="bg-[#1F293D] border border-[#374151] text-gray-300 text-xs font-semibold rounded-xl px-4 py-2 hover:bg-[#374151] transition-colors"
                  disabled={actionLoading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl px-4 py-2 hover:shadow-[0_4px_12px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50"
                >
                  {actionLoading ? "处理中..." : "确认执行"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
