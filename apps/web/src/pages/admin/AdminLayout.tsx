// 职责：管理后台主布局框架，内置前端权限守卫，负责子面板的 Tab 导航和安全阻断
// 路由：/admin
// 鉴权：需要通过 useAuth 获取 adminLevel，非管理员重定向至首页

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import { RechargePanel } from "./RechargePanel.tsx";
import { CreditsPanel } from "./CreditsPanel.tsx";
import { ApiConfigPanel } from "./ApiConfigPanel.tsx";
import { StaffPanel } from "./StaffPanel.tsx";

export const AdminLayout: React.FC = () => {
  const { adminLevel, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"recharge" | "credits" | "apiConfig" | "staff">("recharge");

  // 路由权限守卫
  useEffect(() => {
    if (!loading && adminLevel === 0) {
      console.warn("[AdminLayout] 越权访问后台，已自动重定向回首页");
      navigate("/");
    }
  }, [adminLevel, loading, navigate]);

  useEffect(() => {
    if (!loading && activeTab === "staff" && adminLevel !== 1) {
      setActiveTab("recharge");
      navigate("/admin");
    }
  }, [activeTab, adminLevel, loading, navigate]);

  // 如果还在加载，显示等待状态
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-500">
        正在核验管理员身份...
      </div>
    );
  }

  // 若不是管理员，阻断渲染
  if (adminLevel === 0) {
    return null;
  }

  // 访问人员管理限制（普通管理员不可越权访问）
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">KK AI 开发者管理后台</h1>
            <p className="text-xs text-gray-500 mt-1">
              您当前的身份：
              <span className="font-semibold text-blue-600">
                {adminLevel === 1 ? "超级管理员" : "普通管理员"}
              </span>
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-xs text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg px-3 py-1.5 font-medium transition-colors"
          >
            返回工作区
          </button>
        </div>

        {/* Tab 导航头，-mb-[1px] 用于完美覆盖底部分隔线 */}
        <div className="border-b border-gray-200 flex gap-6 mb-8">
          <button
            onClick={() => setActiveTab("recharge")}
            className={`pb-3 px-1 text-sm transition-all ${
              activeTab === "recharge"
                ? "text-gray-900 font-semibold border-b-2 border-blue-600 -mb-[1px]"
                : "text-gray-500 font-normal border-b-2 border-transparent hover:text-gray-700"
            }`}
          >
            充值管理
          </button>

          <button
            onClick={() => setActiveTab("credits")}
            className={`pb-3 px-1 text-sm transition-all ${
              activeTab === "credits"
                ? "text-gray-900 font-semibold border-b-2 border-blue-600 -mb-[1px]"
                : "text-gray-500 font-normal border-b-2 border-transparent hover:text-gray-700"
            }`}
          >
            积分调整
          </button>

          <button
            onClick={() => setActiveTab("apiConfig")}
            className={`pb-3 px-1 text-sm transition-all ${
              activeTab === "apiConfig"
                ? "text-gray-900 font-semibold border-b-2 border-blue-600 -mb-[1px]"
                : "text-gray-500 font-normal border-b-2 border-transparent hover:text-gray-700"
            }`}
          >
            API 计费定价
          </button>

          {adminLevel === 1 && (
            <button
              onClick={() => setActiveTab("staff")}
              className={`pb-3 px-1 text-sm transition-all ${
                activeTab === "staff"
                  ? "text-gray-900 font-semibold border-b-2 border-blue-600 -mb-[1px]"
                  : "text-gray-500 font-normal border-b-2 border-transparent hover:text-gray-700"
              }`}
            >
              人员管理 (超管)
            </button>
          )}
        </div>

        {/* 渲染子面板 */}
        <div className="transition-opacity duration-150">
          {activeTab === "recharge" && <RechargePanel />}
          {activeTab === "credits" && <CreditsPanel />}
          {activeTab === "apiConfig" && <ApiConfigPanel />}
          {activeTab === "staff" && adminLevel === 1 && <StaffPanel />}
        </div>
      </div>
    </div>
  );
};
