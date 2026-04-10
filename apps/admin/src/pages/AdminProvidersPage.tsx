import { useCallback, useEffect, useState } from 'react';

import type { AdminCreditProviderDto } from '../../../../packages/contracts/src/index.ts';
import { buildSaveAdminCreditProviderPayload, createProviderEditorState, type ProviderEditorState } from '../features/providers/providerEditorModel.ts';
import { createAdminApiClient } from '../services/adminApiClient';

const client = createAdminApiClient();

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<ProviderEditorState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    const response = await client.listAdminCreditProviders();
    if (!response.success) {
      setError(response.error?.message || 'Failed to load providers.');
      return;
    }

    setError(null);
    setProviders(response.data.items.map((item: AdminCreditProviderDto) => createProviderEditorState(item)));
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  async function handleSave(provider: ProviderEditorState) {
    const response = await client.saveAdminCreditProvider(
      provider.id,
      buildSaveAdminCreditProviderPayload(provider),
    );

    if (!response.success) {
      setError(response.error?.message || 'Failed to save provider.');
      return;
    }

    await loadProviders();
  }

  return (
    <section>
      <h1>System Providers</h1>
      {error ? <p>{error}</p> : null}
      {providers.map((provider) => (
        <article key={provider.id}>
          <strong>{provider.providerName}</strong>
          <span>{provider.baseUrl}</span>
          <button type="button" onClick={() => void handleSave(provider)}>Save</button>
        </article>
      ))}
    </section>
  );
}
