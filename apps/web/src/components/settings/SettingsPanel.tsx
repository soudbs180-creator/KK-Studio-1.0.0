/**
 * 简体中文警告：
 * 本文件仅用于遗留代码的向后兼容，以保证 Workspace 弹窗与部分老旧入口能够正常构建。
 * 严禁在任何新编写的业务模块或功能中直接 import SettingsPanel。
 * 新增功能必须 import { SettingsWorkbenchPanel } from './SettingsWorkbenchPanel'。
 */
import React from 'react';
import '../../styles/settings.css';
import SettingsWorkbenchPanel, {
  type SettingsPanelProps,
} from './SettingsWorkbenchPanel';

const SettingsPanel: React.FC<SettingsPanelProps> = (props) => <SettingsWorkbenchPanel {...props} />;

export type { SettingsPanelProps } from './SettingsWorkbenchPanel';
export type { SettingsViewId } from './settingsRegistry';
export default SettingsPanel;
