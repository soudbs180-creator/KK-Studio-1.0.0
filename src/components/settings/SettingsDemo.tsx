/**
 * SettingsPanel 示例入口 - 展示改进后的UI
 * 使用方法：在 App.tsx 中导入此组件代替原来的 SettingsPanel
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Settings } from 'lucide-react';
import SettingsPanel from './SettingsPanel';

// 示例按钮组件
export const SettingsButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-white shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-xl"
      >
        <Settings size={20} />
        <span className="font-medium">打开设置（新版）</span>
      </button>

      <BrowserRouter>
        <SettingsPanel 
          isOpen={isOpen} 
          onClose={() => setIsOpen(false)}
        />
      </BrowserRouter>
    </>
  );
};

// 演示对比组件
export const SettingsComparison: React.FC = () => {
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">SettingsPanel 改进对比</h1>
      
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* 旧版本 */}
        <div className="p-6 border rounded-xl bg-gray-50">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">旧版本</h2>
          <ul className="space-y-2 text-gray-600">
            <li>❌ 内部状态管理</li>
            <li>❌ 所有视图在一个文件（1636行）</li>
            <li>❌ 简单文字 loading</li>
            <li>❌ 移动端部分适配</li>
            <li>❌ 刷新后丢失状态</li>
          </ul>
          <button
            onClick={() => setShowOld(true)}
            className="mt-4 w-full py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
          >
            打开旧版
          </button>
        </div>

        {/* 新版本 */}
        <div className="p-6 border-2 border-indigo-500 rounded-xl bg-indigo-50">
          <h2 className="text-xl font-semibold mb-4 text-indigo-700">新版本 v2.0</h2>
          <ul className="space-y-2 text-indigo-600">
            <li>✅ React Router 6 路由</li>
            <li>✅ 组件拆分（480行主组件）</li>
            <li>✅ 骨架屏动画</li>
            <li>✅ 移动端完全适配</li>
            <li>✅ URL访问+刷新保持</li>
          </ul>
          <button
            onClick={() => setShowNew(true)}
            className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            打开新版
          </button>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-400 rounded-lg p-4 text-yellow-800">
        <strong>提示：</strong> 点击"打开新版"按钮查看改进后的设置面板。主要改进包括：
        骨架屏加载、路由导航、移动端底部抽屉、更清晰的组件结构。
      </div>

      {/* 加载新版本的SettingsPanel */}
      <BrowserRouter>
        <SettingsPanel 
          isOpen={showNew} 
          onClose={() => setShowNew(false)}
        />
      </BrowserRouter>
    </div>
  );
};

export default SettingsButton;
