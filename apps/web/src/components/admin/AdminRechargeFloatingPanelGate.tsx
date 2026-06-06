import React, { Suspense } from 'react';

import { useAdminRole } from '../../hooks/useAdminRole';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

const AdminRechargeFloatingPanel = lazyWithRetry(() => import('./AdminRechargeFloatingPanel'));

const AdminRechargeFloatingPanelGate: React.FC = () => {
  const { isAdmin, adminSessionActive } = useAdminRole();
  const enabled = isAdmin && adminSessionActive;

  if (!enabled) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AdminRechargeFloatingPanel enabled={enabled} />
    </Suspense>
  );
};

export default AdminRechargeFloatingPanelGate;
