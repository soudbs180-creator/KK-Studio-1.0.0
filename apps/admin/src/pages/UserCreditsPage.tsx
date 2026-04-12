import { useState } from 'react';

import type { AdminCreditAccountLookupDto } from '../../../../packages/contracts/src/index.ts';
import { buildAdminRechargeRequest, getLatestCreditBalance } from '../features/user-credits/userCreditLookupModel.ts';
import { createAdminApiClient } from '../services/adminApiClient';

const client = createAdminApiClient();

export default function UserCreditsPage() {
  const [identity, setIdentity] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState(10);
  const [account, setAccount] = useState<AdminCreditAccountLookupDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    setError(null);
    const response = await client.getAdminCreditAccount(identity.trim());
    if (!response.success) {
      setError(response.error?.message || 'Failed to look up user credit account.');
      return;
    }

    setAccount(response.data);
  }

  async function handleRecharge() {
    setError(null);
    const response = await client.adminRechargeCredits(buildAdminRechargeRequest({
      identity,
      creditAmount: rechargeAmount,
      description: 'Admin manual recharge',
    }));
    if (!response.success) {
      setError(response.error?.message || 'Failed to recharge user credits.');
      return;
    }

    await handleLookup();
  }

  return (
    <section>
      <h1>User Credits</h1>
      <input
        value={identity}
        onChange={(event) => setIdentity(event.target.value)}
        placeholder="Email or user id"
      />
      <button type="button" onClick={() => void handleLookup()}>Lookup</button>
      {error ? <p>{error}</p> : null}
      {account ? (
        <div>
          <p>Balance: {getLatestCreditBalance(account)}</p>
          <button type="button" onClick={() => void handleRecharge()}>Recharge</button>
          {account.transactions.map((item) => (
            <article key={item.id}>
              <strong>{item.transactionType}</strong>
              <span>{item.amount}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
