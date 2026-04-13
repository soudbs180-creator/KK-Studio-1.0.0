import React, { Suspense, lazy, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Supplier } from '../../services/billing/supplierService';

const DashboardView = lazy(() => import('./views/DashboardView.localized.tsx'));
const ApiSettingsView = lazy(() => import('./ApiSettingsView'));
const StorageSettingsView = lazy(() => import('./views/StorageSettingsView.localized.tsx'));
const SystemLogsView = lazy(() => import('./views/SystemLogsView.localized.tsx'));

export type SettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs'
  | 'admin-console'
  | 'credit-models'
  | 'exchange-rates'
  | 'admin-system'
  | 'cost-estimation';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: SettingsViewId;
  initialSupplier?: Supplier | null;
}

const modalBackdropStyle: React.CSSProperties = {
  background: 'rgba(2, 6, 23, 0.68)',
  backdropFilter: 'blur(14px)',
};

const modalSurfaceStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderColor: 'var(--border-light)',
  color: 'var(--text-primary)',
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  initialView = 'dashboard',
  initialSupplier = null,
}) => {
  const normalizedView = useMemo<Exclude<SettingsViewId, 'consumption-records' | 'admin-console' | 'credit-models' | 'exchange-rates' | 'admin-system' | 'cost-estimation'>>(() => {
    switch (initialView) {
      case 'api-management':
        return 'api-management';
      case 'storage-settings':
        return 'storage-settings';
      case 'system-logs':
        return 'system-logs';
      default:
        return 'dashboard';
    }
  }, [initialView]);

  if (!isOpen) {
    return null;
  }

  const content = (
    <div
      className="fixed inset-0 z-[10003] flex items-center justify-center p-4"
      style={modalBackdropStyle}
      onClick={onClose}
    >
      <div
        className="flex h-[min(880px,92vh)] w-[min(1200px,96vw)] flex-col overflow-hidden rounded-[28px] border shadow-2xl"
        style={modalSurfaceStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <div>
            <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--text-tertiary)' }}>
              KKAI Local
            </div>
            <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {normalizedView === 'api-management'
                ? '接口管理'
                : normalizedView === 'storage-settings'
                  ? '存储设置'
                  : normalizedView === 'system-logs'
                    ? '系统日志'
                    : '总览'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          <Suspense fallback={null}>
            {normalizedView === 'api-management' ? (
              <ApiSettingsView initialSupplier={initialSupplier} />
            ) : normalizedView === 'storage-settings' ? (
              <StorageSettingsView />
            ) : normalizedView === 'system-logs' ? (
              <SystemLogsView />
            ) : (
              <DashboardView onNavigate={() => undefined} />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default SettingsPanel;
