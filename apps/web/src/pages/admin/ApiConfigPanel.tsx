// 职责：管理员 API 套餐计费定价配置面板，支持查询与直接编辑定价消耗额度
// 路由：子面板，嵌入在 AdminLayout 中
// 鉴权：使用管理员 token 调用接口

import React, { useState, useEffect } from "react";
import { adminGetApiConfig, adminUpdateApiConfig } from "@nano-banana/api-client";
import { getStoredKkApiAccessToken } from "../../services/api/authAccessToken.ts";

interface ApiConfigItem {
  operation_key: "image_generation" | "image_edit" | "chat";
  operation_name: string;
  cost: number;
  is_active: boolean;
}

export const ApiConfigPanel: React.FC = () => {
  // 声明状态变量
  const [configList, setConfigList] = useState<ApiConfigItem[]>([]); // API 定价配置数组
  const [loading, setLoading] = useState(false); // 加载状态
  const [editKey, setEditKey] = useState<string | null>(null); // 当前处于编辑态的 operation_key
  const [editCost, setEditCost] = useState<number>(0); // 编辑中的 cost 数值
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null); // 反馈消息

  const token = getStoredKkApiAccessToken() || "";

  // 加载定价配置
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await adminGetApiConfig(token);
      if (res && Array.isArray(res.config)) {
        setConfigList(res.config);
      }
    } catch (err) {
      console.error("[获取API配置失败]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // 开启单项修改编辑模式
  const handleStartEdit = (item: ApiConfigItem) => {
    setEditKey(item.operation_key);
    setEditCost(item.cost);
    setMessage(null);
  };

  // 提交单项配置修改
  const handleSave = async (key: string) => {
    if (editCost < 0 || editCost > 10000) {
      setMessage({ type: "error", text: "单项消耗积分必须在 0 到 10,000 之间" });
      return;
    }

    try {
      await adminUpdateApiConfig(key, editCost, token);
      setMessage({ type: "success", text: "API 定价参数修改成功" });
      setEditKey(null);
      // 重新加载配置
      fetchConfig();
    } catch (err: any) {
      console.error("[修改API配置失败]", err);
      setMessage({ type: "error", text: err.message || "更新失败，请重试" });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <h2 className="text-base font-semibold text-gray-900">API 消耗与计费设置</h2>
      <p className="text-sm text-gray-500 mt-1">管理员可动态调整每一项 AI 操作所扣减的积分额度，设置后立即对所有请求生效。</p>

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

      <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">操作名称</th>
              <th className="px-4 py-3">操作 Key</th>
              <th className="px-4 py-3">单次积分扣减</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-700">
            {loading && configList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  正在加载数据...
                </td>
              </tr>
            ) : configList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  暂无定价配置数据
                </td>
              </tr>
            ) : (
              configList.map((item) => (
                <tr key={item.operation_key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.operation_name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.operation_key}</td>
                  <td className="px-4 py-3">
                    {editKey === item.operation_key ? (
                      <input
                        type="number"
                        value={editCost}
                        onChange={(e) => setEditCost(parseInt(e.target.value, 10) || 0)}
                        min="0"
                        max="10000"
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-600"
                      />
                    ) : (
                      <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 inline-flex items-center gap-1.5">
                        {item.cost} 积分
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editKey === item.operation_key ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSave(item.operation_key)}
                          className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-blue-700"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditKey(null)}
                          className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded hover:bg-gray-200"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="bg-blue-50 text-blue-600 rounded-full px-3 py-1 text-xs font-medium hover:bg-blue-100"
                      >
                        修改定价
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
