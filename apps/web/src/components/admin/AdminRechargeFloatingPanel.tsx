import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';

import type { AdminRechargeSubmissionDto } from '../../../packages/contracts/src/index.ts';
import { useAdminRole } from '../../hooks/useAdminRole';
import { kkWebApiClient } from '../../services/api/kkApiClient';
import { listAdminRechargeSubmissions } from '../../services/billing/rechargeSubmissionService';
import { notify } from '../../services/system/notificationService';
import { readRuntimeEnv } from '../../utils/runtimeEnv';

function formatAmount(value: number | undefined, currencyCode: string | undefined): string {
  const symbol = currencyCode === 'USD' ? '$' : '¥';
  return `${symbol}${Number(value || 0).toFixed(2)}`;
}

function getRemainingSeconds(item: AdminRechargeSubmissionDto): number {
  if (!item.expiresAt || item.status !== 'paying') {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / 1000));
}

function formatRemaining(item: AdminRechargeSubmissionDto): string {
  const seconds = getRemainingSeconds(item);
  if (item.status !== 'paying') {
    return item.status;
  }
  if (seconds <= 0) {
    return '已超时';
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function sortRechargeSubmissions(items: AdminRechargeSubmissionDto[]): AdminRechargeSubmissionDto[] {
  return [...items].sort((left, right) => {
    const leftMarked = left.status === 'paying' && Boolean(left.paymentMarkedAt);
    const rightMarked = right.status === 'paying' && Boolean(right.paymentMarkedAt);
    if (leftMarked !== rightMarked) {
      return leftMarked ? -1 : 1;
    }

    const leftPaying = left.status === 'paying';
    const rightPaying = right.status === 'paying';
    if (leftPaying !== rightPaying) {
      return leftPaying ? -1 : 1;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function openAdminRechargePage(submissionId?: string) {
  const configuredAdminUrl = readRuntimeEnv('VITE_KK_ADMIN_URL');
  const baseUrl = configuredAdminUrl || '/admin';
  const suffix = submissionId
    ? `/recharge-submissions?submissionId=${encodeURIComponent(submissionId)}`
    : '/recharge-submissions';
  window.open(`${baseUrl.replace(/\/$/, '')}${suffix}`, '_blank', 'noopener,noreferrer');
}

const AdminRechargeFloatingPanel: React.FC = () => {
  const { isAdmin, adminSessionActive } = useAdminRole();
  const [items, setItems] = useState<AdminRechargeSubmissionDto[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 16 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const payingItems = useMemo(
    () => sortRechargeSubmissions(items.filter((item) => item.status === 'paying')).slice(0, 10),
    [items],
  );
  const latest = payingItems[0];

  useEffect(() => {
    if (!isAdmin || !adminSessionActive) {
      setItems([]);
      return undefined;
    }

    let alive = true;
    const load = async () => {
      const response = await listAdminRechargeSubmissions({
        requestId: `admin-floating-recharges-${Date.now()}`,
      }).catch(() => undefined);
      if (!alive || !response?.success) {
        return;
      }
      setItems(response.data.items);
    };

    void load();
    const timer = window.setInterval(load, 10000);
    const clock = window.setInterval(() => {
      setItems((current) => [...current]);
    }, 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [adminSessionActive, isAdmin]);

  if (!isAdmin || !adminSessionActive || payingItems.length === 0) {
    return null;
  }

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!dragRef.current) {
      return;
    }
    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = Math.max(8, dragRef.current.originY + event.clientY - dragRef.current.startY);
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = () => {
    dragRef.current = null;
  };

  const handleDirectCredit = async (submissionId: string) => {
    setProcessingId(submissionId);
    try {
      const response = await kkWebApiClient.reviewRechargeSubmission(submissionId, {
        decision: 'credit',
      }, {
        requestId: `admin-floating-credit-${submissionId}-${Date.now()}`,
      });
      if (!response.success) {
        throw new Error(response.error?.message || '处理充值失败。');
      }
      setItems((current) => current.map((item) => (
        item.submissionId === submissionId ? response.data.submission : item
      )));
      notify.success('充值已入账', `已为 ${response.data.submission.userId} 增加 ${response.data.creditAmount} 积分。`);
    } catch (error) {
      notify.error('处理失败', error instanceof Error ? error.message : '处理充值失败。');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      data-testid="admin-recharge-floating-panel"
      className="fixed left-1/2 z-[210] w-[min(92vw,760px)] select-none rounded-2xl border border-amber-300/30 bg-slate-950/90 text-slate-100 shadow-2xl backdrop-blur"
      style={{ transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)` }}
    >
      <div
        className="flex cursor-move items-center justify-between gap-3 px-4 py-3"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {latest.paymentMarkedAt ? '用户已支付，请优先处理' : '用户正在支付，请处理'}
          </div>
          <div className="truncate text-xs text-slate-400">
            {latest.userId} · {formatAmount(latest.payableAmount ?? latest.amount, latest.currencyCode)} · {latest.creditAmount} 积分
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAdminRechargePage(latest.submissionId)}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            进入处理
            <ExternalLink size={13} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"
            aria-label={collapsed ? '展开充值处理列表' : '缩小充值处理列表'}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {collapsed ? null : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto border-t border-white/10 p-3">
          {payingItems.map((item) => {
            const marked = Boolean(item.paymentMarkedAt);
            return (
              <div
                key={item.submissionId}
                className="grid gap-3 rounded-xl border p-3 text-xs md:grid-cols-[minmax(0,1.4fr)_90px_90px_70px_180px]"
                style={{
                  borderColor: marked ? 'rgba(251,191,36,0.55)' : 'rgba(148,163,184,0.18)',
                  background: marked ? 'rgba(245,158,11,0.16)' : 'rgba(15,23,42,0.78)',
                }}
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{item.userId}</div>
                  <div className="truncate text-slate-400">{item.submissionId}</div>
                </div>
                <div>
                  <div className="text-slate-400">渠道</div>
                  <div>{item.manualProvider === 'wechat' ? '微信' : '支付宝'}</div>
                </div>
                <div>
                  <div className="text-slate-400">实付</div>
                  <div>{formatAmount(item.payableAmount ?? item.amount, item.currencyCode)}</div>
                </div>
                <div>
                  <div className="text-slate-400">积分</div>
                  <div>{item.creditAmount}</div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className={marked ? 'text-amber-200' : 'text-slate-400'}>
                    {formatRemaining(item)}
                  </span>
                  <button
                    type="button"
                    onClick={() => openAdminRechargePage(item.submissionId)}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    进入处理
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDirectCredit(item.submissionId)}
                    disabled={processingId === item.submissionId}
                    className="rounded-md border border-emerald-400/40 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processingId === item.submissionId ? <Loader2 size={12} className="animate-spin" /> : '直接处理'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminRechargeFloatingPanel;
