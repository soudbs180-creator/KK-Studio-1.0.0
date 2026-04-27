import { useEffect, useState } from 'react';

import type { AdminRechargeSubmissionDto } from '../../../../packages/contracts/src/index.ts';
import { createAdminApiClient } from '../services/adminApiClient';

const client = createAdminApiClient();

const STATUS_LABELS: Record<string, string> = {
  created: '已创建',
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  credited: '已入账',
  paying: '支付中',
  expired: '已过期',
};

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}

export default function RechargeSubmissionsPage() {
  const [items, setItems] = useState<AdminRechargeSubmissionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadSubmissions() {
    setError(null);
    const response = await client.listAdminRechargeSubmissions();
    if (!response.success) {
      setError(response.error?.message || 'Failed to load recharge submissions.');
      return;
    }

    setItems(response.data.items);
  }

  useEffect(() => {
    void loadSubmissions();
  }, []);

  async function review(submissionId: string, decision: 'credit' | 'reject') {
    setBusyId(submissionId);
    setError(null);
    const response = await client.reviewRechargeSubmission(submissionId, { decision });
    if (!response.success) {
      setError(response.error?.message || 'Failed to review recharge submission.');
      setBusyId(null);
      return;
    }

    await loadSubmissions();
    setBusyId(null);
  }

  return (
    <section>
      <h1>Recharge Submissions</h1>
      {error ? <p>{error}</p> : null}
      {items.map((item) => (
        <article key={item.submissionId}>
          <h2>{item.submissionId}</h2>
          <p>User: {item.userId}</p>
          <p>Status: {getStatusLabel(item.status)}</p>
          <p>Amount: {item.amount} {item.currencyCode}</p>
          <p>Credits: {item.creditAmount}</p>
          <p>Paid at: {item.paymentMarkedAt || '--'}</p>
          <button
            type="button"
            disabled={busyId === item.submissionId}
            onClick={() => void review(item.submissionId, 'credit')}
          >
            Credit
          </button>
          <button
            type="button"
            disabled={busyId === item.submissionId}
            onClick={() => void review(item.submissionId, 'reject')}
          >
            Reject
          </button>
        </article>
      ))}
    </section>
  );
}
