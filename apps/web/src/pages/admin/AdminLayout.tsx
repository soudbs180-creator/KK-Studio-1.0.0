// 职责：管理后台主布局框架，内置前端权限守卫，负责子面板的 Tab 导航和安全阻断
// 路由：/admin
// 鉴权：需要通过 useAuth 获取 adminLevel，非管理员重定向至首页

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { UserManagementPanel } from "./UserManagementPanel.tsx";
import { RechargePanel } from "./RechargePanel.tsx";
import { CreditsPanel } from "./CreditsPanel.tsx";
import { ApiConfigPanel } from "./ApiConfigPanel.tsx";
import { StaffPanel } from "./StaffPanel.tsx";
import { Shield, HelpCircle, X, ShieldAlert, Award, ArrowLeft } from "lucide-react";

export const AdminLayout: React.FC = () => {
  const { adminLevel, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "recharge" | "credits" | "apiConfig" | "staff">("users");
  const [showExplain, setShowExplain] = useState(false); // 控制权限说明 Popover 弹框

  // 路由权限守卫
  useEffect(() => {
    if (!loading && adminLevel === 0) {
      console.warn("[AdminLayout] 越权访问后台，已自动重定向回首页");
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [adminLevel, loading]);

  useEffect(() => {
    if (!loading && activeTab === "staff" && adminLevel !== 1) {
      setActiveTab("users");
      window.history.pushState({}, "", "/admin");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [activeTab, adminLevel, loading]);

  // 如果还在加载，显示等待状态 (暗色)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0F19] text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-sm font-medium">正在核验管理员身份...</span>
        </div>
      </div>
    );
  }

  // 若不是管理员，阻断渲染
  if (adminLevel === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 p-6 md:p-8 font-sans transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        {/* 顶部标题栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1F293D] pb-5 mb-8 gap-4 relative">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-wide flex items-center gap-2 drop-shadow-[0_2px_8px_rgba(59,130,246,0.15)]">
              <Shield className="text-blue-500" size={24} />
              KK AI 开发者管理后台
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-gray-400">
                您当前的身份：
                <span className={`font-semibold ${adminLevel === 1 ? "text-red-400" : "text-emerald-400"}`}>
                  {adminLevel === 1 ? "超级管理员" : "普通管理员"}
                </span>
              </p>
              {/* 权限解惑问号按钮 */}
              <button
                type="button"
                onClick={() => setShowExplain(!showExplain)}
                className="text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1 text-[11px]"
                title="查看管理员权限详情"
              >
                <HelpCircle size={13} />
                <span className="underline">权限说明</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              window.history.pushState({}, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            className="text-xs text-gray-300 bg-[#1E293B] border border-[#334155] hover:bg-[#334155] rounded-xl px-4 py-2 font-semibold transition-all inline-flex items-center gap-1.5 self-start sm:self-center"
          >
            <ArrowLeft size={13} />
            返回工作区
          </button>

          {/* 权限解释说明 Popover 卡片 */}
          {showExplain && (
            <div className="absolute top-16 left-0 sm:left-auto sm:right-0 z-50 bg-[#111827] border border-[#1F293D] rounded-2xl p-5 shadow-2xl max-w-sm w-full animate-in fade-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between border-b border-[#1F293D] pb-3 mb-3">
                <span className="font-bold text-white text-sm flex items-center gap-1.5">
                  <ShieldAlert className="text-blue-500" size={16} />
                  管理员权限体系说明
                </span>
                <button
                  onClick={() => setShowExplain(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4 text-xs text-gray-300">
                <div>
                  <h4 className="font-bold text-emerald-400 flex items-center gap-1 mb-1.5">
                    <Award size={14} />
                    普通管理员 (Level 2)
                  </h4>
                  <p className="leading-relaxed pl-5">
                    负责日常运营与定价维护。可以使用<strong>“用户管理”</strong>查看检索注册用户，执行<strong>“充值管理”</strong>和<strong>“积分微调”</strong>，并且可以进入<strong>“API 计费定价”</strong>修改模型扣点定价。
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-red-400 flex items-center gap-1 mb-1.5">
                    <ShieldAlert size={14} />
                    高级/超级管理员 (Level 1)
                  </h4>
                  <p className="leading-relaxed pl-5">
                    拥有普通管理员的所有权限。此外，专属特权是可以使用<strong>“人员管理”</strong>面板——能够将普通用户提拔为普通管理员，或撤销其权限。超级管理员本身属于系统根基，无法通过前端降级。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab 导航头 - 冰蓝高品质发光线条 */}
        <div className="border-b border-[#1F293D] flex gap-2 md:gap-6 mb-8 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 px-2 text-sm transition-all whitespace-nowrap ${
              activeTab === "users"
                ? "text-white font-bold border-b-2 border-blue-500 -mb-[1px] drop-shadow-[0_2px_4px_rgba(59,130,246,0.3)]"
                : "text-gray-400 font-normal border-b-2 border-transparent hover:text-gray-200"
            }`}
          >
            用户管理
          </button>

          <button
            onClick={() => setActiveTab("recharge")}
            className={`pb-3 px-2 text-sm transition-all whitespace-nowrap ${
              activeTab === "recharge"
                ? "text-white font-bold border-b-2 border-blue-500 -mb-[1px] drop-shadow-[0_2px_4px_rgba(59,130,246,0.3)]"
                : "text-gray-400 font-normal border-b-2 border-transparent hover:text-gray-200"
            }`}
          >
            充值管理
          </button>

          <button
            onClick={() => setActiveTab("credits")}
            className={`pb-3 px-2 text-sm transition-all whitespace-nowrap ${
              activeTab === "credits"
                ? "text-white font-bold border-b-2 border-blue-500 -mb-[1px] drop-shadow-[0_2px_4px_rgba(59,130,246,0.3)]"
                : "text-gray-400 font-normal border-b-2 border-transparent hover:text-gray-200"
            }`}
          >
            积分调整
          </button>

          <button
            onClick={() => setActiveTab("apiConfig")}
            className={`pb-3 px-2 text-sm transition-all whitespace-nowrap ${
              activeTab === "apiConfig"
                ? "text-white font-bold border-b-2 border-blue-500 -mb-[1px] drop-shadow-[0_2px_4px_rgba(59,130,246,0.3)]"
                : "text-gray-400 font-normal border-b-2 border-transparent hover:text-gray-200"
            }`}
          >
            API 计费定价
          </button>

          {adminLevel === 1 && (
            <button
              onClick={() => setActiveTab("staff")}
              className={`pb-3 px-2 text-sm transition-all whitespace-nowrap ${
                activeTab === "staff"
                  ? "text-white font-bold border-b-2 border-blue-500 -mb-[1px] drop-shadow-[0_2px_4px_rgba(59,130,246,0.3)]"
                  : "text-gray-400 font-normal border-b-2 border-transparent hover:text-gray-200"
              }`}
            >
              人员管理 (超管)
            </button>
          )}
        </div>

        {/* 渲染子面板 */}
        <div className="transition-all duration-200 animate-in fade-in duration-300">
          {activeTab === "users" && <UserManagementPanel />}
          {activeTab === "recharge" && <RechargePanel />}
          {activeTab === "credits" && <CreditsPanel />}
          {activeTab === "apiConfig" && <ApiConfigPanel />}
          {activeTab === "staff" && adminLevel === 1 && <StaffPanel />}
        </div>
      </div>
    </div>
  );
};
