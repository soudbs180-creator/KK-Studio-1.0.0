import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw, Save } from 'lucide-react';

import type { AdminCreditProviderDto } from '../../../../packages/contracts/src/index.ts';
import {
  buildSaveAdminCreditProviderPayload,
  createDefaultProviderEditorState,
  createProviderEditorState,
  hasProviderApiKeysForSave,
  type ProviderEditorModelState,
  type ProviderEditorState,
} from '../features/providers/providerEditorModel.ts';
import { createAdminApiClient } from '../services/adminApiClient';

const client = createAdminApiClient();
const defaultModelTemplate = createDefaultProviderEditorState().models[0];

function updateModelField(
  model: ProviderEditorModelState,
  field: keyof ProviderEditorModelState,
  value: string | number | boolean,
): ProviderEditorModelState {
  return {
    ...model,
    [field]: value,
  };
}

function toPositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

  function handleCreateDefaultProvider() {
    setProviders((current) => {
      if (current.some((provider) => provider.id === 'system-image-provider')) {
        return current;
      }

      return [createDefaultProviderEditorState(), ...current];
    });
  }

  function handleProviderChange(index: number, patch: Partial<ProviderEditorState>) {
    setProviders((current) => current.map((provider, providerIndex) => (
      providerIndex === index ? { ...provider, ...patch } : provider
    )));
  }

  function handleModelChange(
    providerIndex: number,
    modelIndex: number,
    field: keyof ProviderEditorModelState,
    value: string | number | boolean,
  ) {
    setProviders((current) => current.map((provider, index) => {
      if (index !== providerIndex) return provider;

      return {
        ...provider,
        models: provider.models.map((model, currentModelIndex) => (
          currentModelIndex === modelIndex ? updateModelField(model, field, value) : model
        )),
      };
    }));
  }

  function handleAddDefaultModel(providerIndex: number) {
    setProviders((current) => current.map((provider, index) => (
      index === providerIndex
        ? { ...provider, models: [...provider.models, { ...defaultModelTemplate }] }
        : provider
    )));
  }

  async function handleSave(provider: ProviderEditorState) {
    if (!hasProviderApiKeysForSave(provider)) {
      setError('Add at least one provider API key before saving this route.');
      return;
    }

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
    <section className="admin-providers-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-kicker">Runtime model routing</p>
          <h1>System Providers</h1>
        </div>
        <div className="admin-page-actions">
          <button
            type="button"
            className="admin-secondary-button"
            data-testid="admin-provider-bootstrap"
            onClick={handleCreateDefaultProvider}
          >
            <Plus size={16} aria-hidden="true" />
            Create system provider
          </button>
          <button type="button" className="admin-ghost-button" onClick={() => void loadProviders()}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {error ? <p className="admin-inline-error">{error}</p> : null}

      {providers.length === 0 ? (
        <div className="admin-empty-state">
          <KeyRound size={24} aria-hidden="true" />
          <strong>No active provider drafts</strong>
          <button
            type="button"
            className="admin-primary-button"
            data-testid="admin-provider-bootstrap"
            onClick={handleCreateDefaultProvider}
          >
            <Plus size={16} aria-hidden="true" />
            Create system provider
          </button>
        </div>
      ) : null}

      <div className="admin-provider-list">
        {providers.map((provider, providerIndex) => (
          <article className="admin-provider-card" key={`${provider.id}-${providerIndex}`}>
            <div className="admin-provider-card__header">
              <div>
                <p className="admin-provider-card__eyebrow">Provider</p>
                <h2>{provider.providerName || provider.id}</h2>
              </div>
              <button type="button" className="admin-primary-button" onClick={() => void handleSave(provider)}>
                <Save size={16} aria-hidden="true" />
                Save provider
              </button>
            </div>

            <div className="admin-provider-form-grid">
              <label className="admin-field">
                <span>Provider ID</span>
                <input
                  value={provider.id}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => handleProviderChange(providerIndex, {
                    id: event.target.value.trim(),
                  })}
                />
              </label>
              <label className="admin-field">
                <span>Provider name</span>
                <input
                  value={provider.providerName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => handleProviderChange(providerIndex, {
                    providerName: event.target.value,
                  })}
                />
              </label>
              <label className="admin-field admin-field--wide">
                <span>Base URL</span>
                <input
                  value={provider.baseUrl}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => handleProviderChange(providerIndex, {
                    baseUrl: event.target.value.trim(),
                  })}
                />
              </label>
              <label className="admin-field admin-field--wide">
                <span>New API keys</span>
                <textarea
                  data-testid="admin-provider-api-key-input"
                  value={provider.apiKeyInput}
                  rows={3}
                  placeholder="Paste one key per line. Existing retained keys stay hidden."
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => handleProviderChange(providerIndex, {
                    apiKeyInput: event.target.value,
                  })}
                />
              </label>
            </div>

            <div className="admin-model-section">
              <div className="admin-model-section__header">
                <strong>Models</strong>
                <button type="button" className="admin-ghost-button" onClick={() => handleAddDefaultModel(providerIndex)}>
                  <Plus size={16} aria-hidden="true" />
                  Add Nano Banana 2
                </button>
              </div>

              {provider.models.map((model, modelIndex) => (
                <div className="admin-model-row" key={`${model.modelId}-${modelIndex}`}>
                  <label className="admin-field">
                    <span>Model ID</span>
                    <input
                      value={model.modelId}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => handleModelChange(
                        providerIndex,
                        modelIndex,
                        'modelId',
                        event.target.value.trim(),
                      )}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Display name</span>
                    <input
                      value={model.displayName}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => handleModelChange(
                        providerIndex,
                        modelIndex,
                        'displayName',
                        event.target.value,
                      )}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Endpoint</span>
                    <select
                      value={model.endpointType}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => handleModelChange(
                        providerIndex,
                        modelIndex,
                        'endpointType',
                        event.target.value,
                      )}
                    >
                      <option value="openai">OpenAI compatible</option>
                      <option value="gemini">Gemini native</option>
                      <option value="claude">Claude native</option>
                    </select>
                  </label>
                  <label className="admin-field">
                    <span>Credits</span>
                    <input
                      type="number"
                      min={1}
                      value={model.creditCost}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => handleModelChange(
                        providerIndex,
                        modelIndex,
                        'creditCost',
                        toPositiveNumber(event.target.value, model.creditCost),
                      )}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Priority</span>
                    <input
                      type="number"
                      min={0}
                      value={model.priority ?? 0}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => handleModelChange(
                        providerIndex,
                        modelIndex,
                        'priority',
                        toPositiveNumber(event.target.value, 0),
                      )}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Weight</span>
                    <input
                      type="number"
                      min={0}
                      value={model.weight ?? 0}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => handleModelChange(
                        providerIndex,
                        modelIndex,
                        'weight',
                        toPositiveNumber(event.target.value, 0),
                      )}
                    />
                  </label>
                  <label className="admin-toggle-field">
                    <input
                      type="checkbox"
                      checked={model.isActive}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => handleModelChange(
                        providerIndex,
                        modelIndex,
                        'isActive',
                        event.target.checked,
                      )}
                    />
                    <span>Active</span>
                  </label>
                  <label className="admin-toggle-field">
                    <input
                      type="checkbox"
                      checked={model.advancedEnabled}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => handleModelChange(
                        providerIndex,
                        modelIndex,
                        'advancedEnabled',
                        event.target.checked,
                      )}
                    />
                    <span>Advanced pricing</span>
                  </label>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
