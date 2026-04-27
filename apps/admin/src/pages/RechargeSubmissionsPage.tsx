import { useEffect, useMemo, useState } from 'react';

import type { AdminRechargeSubmissionDto } from '../../../../packages/contracts/src/index.ts';
import { createAdminApiClient } from '../services/adminApiClient';

const client = createAdminApiClient();

const GROUPS: Array<{
  key: 'paying' | 'credited' | 'expired' | 'rejected';
  title: string;
}> = [
  { key: 'paying', title: '支付中' },
  { key: 'credited', title: '已入账' },
  { key: 'expired', title: '已过期' },
  { key: 'rejected', title: '已拒绝' },
];

function getVisibleStatus(item: AdminRechargeSubmissionDto): 'paying' | 'credited' | 'expired' | 'rejected' {
  if (item.status === 'credited' || item.status === 'rejected' || item.status === 'expired') {
    return item.status;
  }

  if (item.status === 'paying' && item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) {
    return 'expired';
  }

  return 'paying';
}

function formatAmount(value: number | undefined, currencyCode: string | undefined): string {
  const symbol = currencyCode === 'USD' ? '$' : '¥';
  return `${symbol}${Number(value || 0).toFixed(2)}`;
}

function sortItems(items: AdminRechargeSubmissionDto[]): AdminRechargeSubmissionDto[] {
  return [...items].sort((left, right) => {
    const leftMarked = left.status === 'paying' && Boolean(left.paymentMarkedAt);
    const rightMarked = right.status === 'paying' && Boolean(right.paymentMarkedAt);
    if (leftMarked !== rightMarked) {
      return leftMarked ? -1 : 1;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export default function RechargeSubmissionsPage() {
  const [items, setItems] = useState<AdminRechargeSubmissionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const highlightedSubmissionId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('submissionId')
    : null;

  const grouped = useMemo(() => {
    const result: Record<'paying' | 'credited' | 'expired' | 'rejected', AdminRechargeSubmissionDto[]> = {
      paying: [],
      credited: [],
      expired: [],
      rejected: [],
    };

    sortItems(items).forEach((item) => {
      result[getVisibleStatus(item)].push(item);
    });

    return result;
  }, [items]);

  async function loadItems() {
    setError(null);
    const response = await client.listAdminRechargeSubmissions();
    if (!response.success) {
      setError(response.error?.message || 'Failed to load recharge submissions.');
      return;
    }

    setItems(response.data.items);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void client.listAdminRechargeSubmissions()
      .then((response) => {
        if (!alive) {
          return;
        }
        if (!response.success) {
          setError(response.error?.message || 'Failed to load recharge submissions.');
          return;
        }
        setItems(response.data.items);
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  async function handleReview(submissionId: string, decision: 'credit' | 'reject') {
    setProcessingId(submissionId);
    setError(null);
    const response = await client.reviewRechargeSubmission(submissionId, { decision });
    if (!response.success) {
      setError(response.error?.message || 'Failed to review recharge submission.');
      setProcessingId(null);
      return;
    }

    setItems((current) => current.map((item) => (
      item.submissionId === submissionId ? response.data.submission : item
    )));
    setProcessingId(null);
    await loadItems();
  }

  return (
    <section>
      <h1>Recharge Submissions</h1>
      <p>人工充值处理页只展示账号、用户 ID、积分和充值状态，不展示用户本地 API 信息。</p>
      <button type="button" onClick={() => void loadItems()}>Refresh</button>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}

      {GROUPS.map((group) => (
        <section key={group.key}>
          <h2>{group.title}</h2>
          {grouped[group.key].length === 0 ? <p>No submissions.</p> : null}
          {grouped[group.key].map((item) => {
            const highlighted = item.submissionId === highlightedSubmissionId || Boolean(item.paymentMarkedAt);
            const canReview = getVisibleStatus(item) === 'paying';

            return (
              <article
                key={item.submissionId}
                style={{
                  border: highlighted ? '1px solid #f59e0b' : '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: 12,
                  margin: '12px 0',
                  padding: 16,
                }}
              >
                <strong>{item.paymentMarkedAt ? '用户已支付，请优先处理' : item.submissionId}</strong>
                <p>账号 / 用户 ID：{item.userId}</p>
                <p>渠道：{item.manualProvider === 'wechat' ? '微信' : '支付宝'}</p>
                <p>实付金额：{formatAmount(item.payableAmount ?? item.amount, item.currencyCode)}</p>
                <p>到账积分：{item.creditAmount}</p>
                <p>充值状态：{getVisibleStatus(item)}</p>
                <p>创建时间：{item.createdAt}</p>
                {item.paymentMarkedAt ? <p>用户已支付：{item.paymentMarkedAt}</p> : null}
                {canReview ? (
                  <div>
                    <button
                      type="button"
                      disabled={processingId === item.submissionId}
                      onClick={() => void handleReview(item.submissionId, 'credit')}
                    >
                      直接入账
                    </button>
                    <button
                      type="button"
                      disabled={processingId === item.submissionId}
                      onClick={() => void handleReview(item.submissionId, 'reject')}
                    >
                      拒绝
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ))}
    </section>
  );
}
