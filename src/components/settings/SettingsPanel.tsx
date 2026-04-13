import React from 'react';
import SettingsWorkbenchPanel, {
  type SettingsPanelProps,
} from './SettingsPanel.localized';

const SettingsPanel: React.FC<SettingsPanelProps> = (props) => <SettingsWorkbenchPanel {...props} />;

// export { default } from './SettingsPanel.localized';
export type { SettingsPanelProps } from './SettingsPanel.localized';
export type { SettingsViewId } from './settingsRegistry';
export default SettingsPanel;
