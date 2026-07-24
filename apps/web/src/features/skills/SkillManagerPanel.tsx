// 简体中文：Skill 技能扩展管理与权限配置面板 (Skill Manager Panel)
// 适配 Awesome Claude Skills 规范与 ToolRegistry 统一挂载

import React, { useState } from 'react';
import type { AgentSkillManifest, SkillCategory, SkillPermission } from '@kk/shared';

export interface SkillManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  skills: AgentSkillManifest[];
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  onRegisterCustomSkill?: (manifest: Partial<AgentSkillManifest>) => void;
}

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  design: '🎨 视觉设计',
  coding: '💻 编程开发',
  marketing: '📈 营销推广',
  workflow: '⚙️ 工作流自动化',
  utility: '🛠️ 通用工具',
  multimedia: '🎥 多媒体创作'
};

export const SkillManagerPanel: React.FC<SkillManagerPanelProps> = ({
  isOpen,
  onClose,
  skills,
  onToggleSkill,
  onRegisterCustomSkill
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredSkills = skills.filter((s) => {
    const matchCategory = selectedCategory === 'all' || s.category === selectedCategory;
    const matchQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[650px] text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
          <div>
            <h2 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
              <span>🧩</span> 技能扩展工作台 (Awesome Claude Skills)
            </h2>
            <p className="text-xs text-slate-400">管理、审查权限并向 Agent ToolRegistry 动态挂载技能</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Toolbar & Filter */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/80 flex items-center gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索技能名称或描述..."
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              全部
            </button>
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Skill List Grid */}
        <div className="p-6 flex-1 overflow-y-auto grid grid-cols-2 gap-4">
          {filteredSkills.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
              <span>📭 暂无符合条件的技能</span>
            </div>
          ) : (
            filteredSkills.map((skill) => (
              <div
                key={skill.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  skill.enabled
                    ? 'bg-slate-950/40 border-indigo-500/40 shadow-lg shadow-indigo-950/20'
                    : 'bg-slate-950/20 border-slate-800/80 opacity-75'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{skill.icon || '🛠️'}</span>
                      <div>
                        <h3 className="font-semibold text-sm text-slate-100">{skill.name}</h3>
                        <span className="text-[10px] text-slate-400">v{skill.version} • {CATEGORY_LABELS[skill.category]}</span>
                      </div>
                    </div>
                    {/* Toggle Switch */}
                    <button
                      onClick={() => onToggleSkill(skill.id, !skill.enabled)}
                      className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${
                        skill.enabled ? 'bg-indigo-600 justify-end' : 'bg-slate-700 justify-start'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-white shadow-md"></span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 mb-3 line-clamp-2">{skill.description}</p>

                  {/* Permissions */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {skill.permissions.map((perm: SkillPermission) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 bg-slate-800/90 border border-slate-700 text-[10px] text-slate-400 rounded"
                      >
                        🔒 {perm}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-500">
                  <span>作者: {skill.author || '官方预置'}</span>
                  <span>挂载状态: {skill.enabled ? '已激活' : '未挂载'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-between items-center bg-slate-950/60">
          <span className="text-xs text-slate-400">已激活 {skills.filter((s) => s.enabled).length} / {skills.length} 个技能</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
