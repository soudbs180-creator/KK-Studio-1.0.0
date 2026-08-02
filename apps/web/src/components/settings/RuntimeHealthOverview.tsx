import React from 'react';
import { Activity, ExternalLink, RefreshCw } from 'lucide-react';
import type { RuntimeServiceHealthDto } from '@kk/shared';
import { useLocale } from '../../context/LocaleContext';
import { SettingsBadge, SettingsSection } from './SettingsScaffold';

function statusTone(status: RuntimeServiceHealthDto['status']) {
  if (status === 'ready') return 'emerald' as const;
  if (status === 'degraded' || status === 'disabled') return 'amber' as const;
  return 'rose' as const;
}

interface RuntimeHealthOverviewProps {
  services: RuntimeServiceHealthDto[];
  onRetry: () => void;
}

/** Renders independently probed runtime services and executable recovery actions. */
export const RuntimeHealthOverview: React.FC<RuntimeHealthOverviewProps> = ({ services, onRetry }) => {
  const { pick } = useLocale();
  const runAction = (action: RuntimeServiceHealthDto['recoveryActions'][number]) => {
    if (action.action === 'retry') {
      onRetry();
      return;
    }
    if (action.action === 'open-settings' && action.target) {
      window.location.assign(action.target);
      return;
    }
    if (action.action === 'open-documentation' && action.target) {
      window.open(action.target, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <SettingsSection title={pick('系统运行状态', 'Runtime health')}>
      <div className="settings-runtime-health-grid">
        {services.map((service) => (
          <article key={service.serviceId} className="settings-runtime-health-card">
            <header>
              <div className="settings-runtime-health-card__identity">
                <span className="settings-runtime-health-card__icon"><Activity size={15} /></span>
                <div>
                  <strong>{service.label}</strong>
                  <span>{new Date(service.checkedAt).toLocaleTimeString()}</span>
                </div>
              </div>
              <SettingsBadge tone={statusTone(service.status)}>{service.status}</SettingsBadge>
            </header>
            <dl>
              <div>
                <dt>{pick('连接', 'Connection')}</dt>
                <dd>{service.reachable ? pick('可达', 'Reachable') : pick('不可达', 'Unavailable')}</dd>
              </div>
              <div>
                <dt>{pick('延迟', 'Latency')}</dt>
                <dd>{service.latencyMs === undefined ? '—' : `${service.latencyMs} ms`}</dd>
              </div>
              <div>
                <dt>{pick('版本', 'Version')}</dt>
                <dd>{service.version || '—'}</dd>
              </div>
            </dl>
            {service.message ? <p>{service.message}</p> : null}
            <footer>
              {service.recoveryActions.map((action) => (
                <button key={action.id} type="button" onClick={() => runAction(action)}>
                  {action.action === 'retry' ? <RefreshCw size={13} /> : <ExternalLink size={13} />}
                  {action.label}
                </button>
              ))}
            </footer>
          </article>
        ))}
      </div>
    </SettingsSection>
  );
};

export default RuntimeHealthOverview;
