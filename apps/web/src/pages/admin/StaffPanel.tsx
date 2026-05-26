// 职责：超级管理员人员管理控制台，提供查询所有用户以及将用户授权为普通管理员或撤销管理员的界面
// 路由：子面板，嵌入在 AdminLayout 中
// 鉴权：仅超级管理员 (adminLevel === 1) 可见并有权操作

import React, { useState, useEffect } from "react";
import { adminGetUsers, adminSetAdminLevel } from "@nano-banana/api-client";
import { getStoredKkApiAccessToken } from "../../services/api/authAccessToken.ts";

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
      fetchUsers();
    } catch (err: any) {
      console.error("[更改管理员级别失败]", err);
      setMessage({
        type: "error",
        text: err.message || "更改管理员权限失败，请重试",
      });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-4xl">
      <h2 className="text-base font-semibold text-gray-900">人员权限管理 (超级管理员专属)</h2>
      <p className="text-sm text-gray-500 mt-1">超级管理员可在此检索所有注册用户，并指定或取消普通管理员 (Level 2)。</p>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm mt-4 ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 搜索框 */}
      <form onSubmit={handleSearchSubmit} className="mt-6 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="按邮箱搜索用户..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 w-80"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          搜索
        </button>
      </form>

      {/* 用户数据表 */}
      <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">用户邮箱</th>
              <th className="px-4 py-3">积分余额</th>
              <th className="px-4 py-3">用户身份</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-700">
            {loading && userList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  正在加载数据...
                </td>
              </tr>
            ) : userList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  暂无匹配的用户
                </td>
              </tr>
            ) : (
              userList.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700">
                      {user.credits} 积分
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.adminLevel === 1 ? (
                      <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        超级管理员 (Level 1)
                      </span>
                    ) : user.adminLevel === 2 ? (
                      <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        普通管理员 (Level 2)
                      </span>
                    ) : (
                      <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        普通用户 (Level 0)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.adminLevel === 1 ? (
                      <span className="text-xs text-gray-400">不可修改</span>
                    ) : (
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        className={`text-xs font-medium rounded-full px-3 py-1 ${
                          user.adminLevel === 2
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
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
      {total > 10 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border border-gray-300 rounded px-3 py-1 text-xs disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-xs text-gray-500">
            第 {page} 页 / 共 {Math.ceil(total / 10)} 页
          </span>
          <button
            onClick={() => setPage((p) => (p * 10 < total ? p + 1 : p))}
            disabled={page * 10 >= total}
            className="border border-gray-300 rounded px-3 py-1 text-xs disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};
