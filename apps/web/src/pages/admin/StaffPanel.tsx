// 职责：超级管理员人员管理控制台，提供查询所有用户以及将用户授权为普通管理员或撤销管理员的界面
// 路由：子面板，嵌入在 AdminLayout 中
// 鉴权：仅超级管理员 (adminLevel === 1) 可见并有权操作

import React, { useState, useEffect } from "react";
import { adminGetUsers, adminSetAdminLevel } from "../../services/api/adminPanelApi.ts";
import { getStoredKkApiAccessToken } from "../../services/api/authAccessToken.ts";
import { ShieldAlert, Award, User, Search, Clock, ShieldCheck } from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  credits: number;
  adminLevel: number;
  createdAt: string;
}

export const StaffPanel: React.FC = () => {
  // 声明状态变量
  const [userList, setUserList] = useState<UserItem[]>([]); // 用户列表
  const [total, setTotal] = useState(0); // 总记录数
  const [page, setPage] = useState(1); // 当前页
  const [search, setSearch] = useState(""); // 搜索词
  const [loading, setLoading] = useState(false); // 加载状态
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null); // 反馈消息

  const token = getStoredKkApiAccessToken() || "";

  // 加载用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await adminGetUsers({ page, limit: 10, search: search.trim() }, token);
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

  // 处理搜索
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  // 设置/取消管理员权限
  const handleToggleAdmin = async (user: UserItem) => {
    setMessage(null);
    const targetLevel = user.adminLevel === 2 ? 0 : 2; // 如果是管理员则降级为用户，否则升级为管理员

    try {
      await adminSetAdminLevel(user.id, targetLevel, token);
      const levelName = targetLevel === 2 ? "普通管理员" : "普通用户";
      setMessage({
        type: "success",
        text: `操作成功！已将用户 ${user.email} 的身份更改为 ${levelName}。`,
      });
      // 重新加载当前页数据
      void fetchUsers();
    } catch (err: any) {
      console.error("[更改管理员级别失败]", err);
      setMessage({
        type: "error",
        text: err.message || "更改管理员权限失败，请重试",
      });
    }
  };

  return (
    <div className="bg-[#111827]/80 border border-[#1F293D] rounded-2xl p-6 max-w-4xl backdrop-blur-md shadow-2xl">
      <div className="border-b border-[#1F293D] pb-3 mb-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="text-red-500" size={18} />
          人员权限管理 <span className="text-[10px] bg-red-500/10 border border-red-500/30 text-red-400 font-semibold px-2 py-0.5 rounded-full">超级管理员专属</span>
        </h2>
        <p className="text-xs text-gray-400 mt-1">超级管理员可在此检索所有注册用户，并指定或撤销普通管理员权限。</p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs mb-4 ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 搜索框 */}
      <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
        <div className="relative text-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入邮箱搜索用户..."
            className="bg-[#1F293D] text-white placeholder-gray-500 border border-[#374151] rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors w-72"
          />
          <Search className="absolute left-3 top-2.5 text-gray-500" size={14} />
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_4px_12px_rgba(59,130,246,0.2)]"
        >
          搜索
        </button>
      </form>

      {/* 用户数据表 */}
      <div className="mt-5 border border-[#1F293D] rounded-xl overflow-hidden bg-[#111827]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#1F293D]/50 text-gray-400 font-semibold border-b border-[#1F293D]">
            <tr>
              <th className="px-4 py-3.5">用户邮箱</th>
              <th className="px-4 py-3.5">积分余额</th>
              <th className="px-4 py-3.5">当前身份</th>
              <th className="px-4 py-3.5 text-right">权限授信</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F293D] text-gray-200">
            {loading && userList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                    正在加载数据...
                  </div>
                </td>
              </tr>
            ) : userList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  暂无匹配的用户
                </td>
              </tr>
            ) : (
              userList.map((user) => (
                <tr key={user.id} className="hover:bg-[#1E293B]/40 transition-colors">
                  <td className="px-4 py-3.5 font-medium">{user.email}</td>
                  <td className="px-4 py-3.5 font-mono text-yellow-400 font-semibold">
                    {user.credits.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">分</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {user.adminLevel === 1 ? (
                      <span className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-full px-2.5 py-1 text-xs inline-flex items-center gap-1.5 font-semibold">
                        <ShieldAlert size={12} />
                        高级管理员 (Level 1)
                      </span>
                    ) : user.adminLevel === 2 ? (
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full px-2.5 py-1 text-xs inline-flex items-center gap-1.5 font-semibold">
                        <Award size={12} />
                        普通管理员 (Level 2)
                      </span>
                    ) : (
                      <span className="bg-gray-500/10 border border-gray-500/20 text-gray-400 rounded-full px-2.5 py-1 text-xs inline-flex items-center gap-1.5">
                        <User size={12} />
                        普通用户 (Level 0)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {user.adminLevel === 1 ? (
                      <span className="text-xs text-gray-500">不可修改</span>
                    ) : (
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        className={`text-xs font-semibold rounded-xl px-3 py-1 transition-all ${
                          user.adminLevel === 2
                            ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white"
                            : "bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white"
                        }`}
                      >
                        {user.adminLevel === 2 ? "撤销管理员" : "设为管理员"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控制 */}
      {!loading && total > 10 && (
        <div className="mt-6 flex items-center justify-between border-t border-[#1F293D] pt-4 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-[#1F293D] hover:bg-[#374151] border border-[#374151] text-gray-300 disabled:opacity-30 rounded-xl px-3 py-1.5 transition-colors disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <span className="text-gray-400">
            第 {page} 页 / 共 {Math.ceil(total / 10)} 页
          </span>
          <button
            onClick={() => setPage((p) => (p * 10 < total ? p + 1 : p))}
            disabled={page * 10 >= total}
            className="bg-[#1F293D] hover:bg-[#374151] border border-[#374151] text-gray-300 disabled:opacity-30 rounded-xl px-3 py-1.5 transition-colors disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};
