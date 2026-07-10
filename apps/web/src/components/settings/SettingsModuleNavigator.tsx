import React, { useMemo } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

import { useLocale } from '../../context/LocaleContext';
import {
  getSettingsModuleId,
  getSettingsModuleItems,
  getSettingsModules,
  type CanonicalSettingsViewId,
} from './settingsRegistry';
import { SETTINGS_SHELL_ACTIONS } from './settingsModuleActions';

const SettingsModuleNavigator: React.FC<{
  activeView: CanonicalSettingsViewId;
  onNavigate: (view: CanonicalSettingsViewId) => void;
}> = ({ activeView, onNavigate }) => {
  const { language, pick } = useLocale();
  const moduleId = getSettingsModuleId(activeView);
  const module = useMemo(
    () => getSettingsModules(language).find((item) => item.id === moduleId),
    [language, moduleId],
  );
  const items = useMemo(
    () => moduleId ? getSettingsModuleItems(language, moduleId) : [],
    [language, moduleId],
  );

  if (!module) return null;

  const Icon = module.icon;

  return (
    <section
      className="settings-module-context"
      data-settings-module-context={module.id}
      aria-label={pick(`${module.label}模块`, `${module.label} module`)}
    >
      <div className="settings-module-context__summary">
        <span className="settings-module-context__icon"><Icon size={18} /></span>
        <span className="min-w-0">
          <strong>{module.label}</strong>
          <span>{module.description}</span>
        </span>
        {module.id === 'ai' ? (
          <span className="settings-module-context__ai-state" title={pick('AI 接管可直接定位这些设置', 'AI takeover can locate these settings')}>
            <Sparkles size={12} />
            {pick('可接管', 'AI ready')}
          </span>
        ) : null}
      </div>

      <nav className="settings-module-context__tabs" aria-label={pick('模块功能', 'Module features')}>
        {items.map((item) => {
          const ItemIcon = item.icon;
          const isActive = item.id === activeView || (item.id === 'capability-sources' && activeView === 'capability-sources');
          return (
            <button
              key={item.id}
              type="button"
              className="settings-module-context__tab"
              data-state={isActive ? 'active' : 'idle'}
              data-ai-settings-target={item.id}
              data-settings-shell-action={SETTINGS_SHELL_ACTIONS.navigateModule.uiAction}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <ItemIcon size={15} />
              <span>{item.label}</span>
              <ChevronRight size={13} className="settings-module-context__tab-chevron" />
            </button>
          );
        })}
      </nav>
    </section>
  );
};

export default SettingsModuleNavigator;
