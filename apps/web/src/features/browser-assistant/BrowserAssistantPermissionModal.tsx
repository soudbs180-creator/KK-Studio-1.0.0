import React from 'react';

interface PermissionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  onConfirm: () => void;
  onCancel: () => void;
}

export const BrowserAssistantPermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  title,
  description,
  riskLevel,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const getRiskBadgeColor = () => {
    switch (riskLevel) {
      case 'high':
        return 'from-rose-500 to-red-600 text-white';
      case 'medium':
        return 'from-amber-400 to-orange-500 text-white';
      default:
        return 'from-emerald-400 to-teal-500 text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-md transition-all duration-300 transform scale-100">
        {/* 顶部红线/橙色装饰 */}
        <div className={`h-1.5 bg-gradient-to-r ${getRiskBadgeColor()}`} />

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white tracking-wide">
              {title}
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-r ${getRiskBadgeColor()}`}>
              {riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '低风险'}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-slate-300 mb-6">
            {description}
          </p>

          <div className="rounded-xl bg-slate-950/50 p-4 border border-white/5 mb-6 text-xs text-slate-400">
            <p className="font-semibold text-slate-300 mb-1">🔐 平台安全边界守卫提示：</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>本系统绝不在云端存储您的 Cookie 或 Session 凭据。</li>
              <li>此动作将直接在您本机的个人 Chrome 浏览器中安全运行。</li>
              <li>非经您逐次确认，AI 绝对无法代表您执行任何购买或删除操作。</li>
            </ul>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-lg text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
            >
              拒绝授权
            </button>
            <button
              onClick={onConfirm}
              className="px-5 py-2 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
            >
              同意执行
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
