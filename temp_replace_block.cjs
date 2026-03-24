const fs = require('fs');
const path = 'src/components/settings/ApiSettingsView.tsx';
const data = fs.readFileSync(path, 'utf-8');
const startMarker = '      {editorMode === null ? (';
const endMarker = '      ) : null}';
const start = data.indexOf(startMarker);
if (start === -1) {
  throw new Error('start marker not found');
}
const end = data.indexOf(endMarker, start);
if (end === -1) {
  throw new Error('end marker not found');
}
const newBlock = `      {editorMode === null ? (
        <div className="settings-reference-stack">
          <div className="settings-reference-page-header">
            <div className="settings-reference-page-header__lead">
              <div className="settings-reference-page-header__eyebrow">Advanced Settings</div>
              <h2>API Management</h2>
              <p>
                Official routes and third-party suppliers now live inside a shared dark console layout that
                aligns much closer with the reference cards.
              </p>
            </div>
            <div className="settings-reference-actions">
              <SettingsBadge tone={attentionCount > 0 ? 'amber' : connectedChannels > 0 ? 'emerald' : 'neutral'}>
                {connectedChannels > 0 ? `${connectedChannels} channels online` : 'No live channel'}
              </SettingsBadge>
              <SettingsActionButton icon={RefreshCw} onClick={refresh}>
                Refresh
              </SettingsActionButton>
              <SettingsActionButton
                icon={Plus}
                tone="primary"
                onClick={activeTab === 'official' ? beginCreateOfficial : beginCreateProvider}
              >
                {activeTab === 'official' ? 'Add Official Route' : 'Add Supplier'}
              </SettingsActionButton>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
            <section className="settings-reference-card">
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__eyebrow">Endpoint Control</div>
                  <div className="settings-reference-card__title">Network Surface</div>
                  <div className="settings-reference-card__meta">
                    Route volume, supplier readiness, budget pressure, and alerts are surfaced together.
                  </div>
                </div>
                <Key size={18} className="text-[var(--text-primary)]" />
              </div>

              <div className="mt-5 settings-reference-metric-grid">
                <div className="settings-reference-mini-metric">
                  <div className="settings-reference-mini-metric__label">Official Routes</div>
                  <div className="settings-reference-mini-metric__value">{officialSlots.length}</div>
                  <div className="settings-reference-mini-metric__helper">
                    {officialSlots.filter((slot) => !slot.disabled).length} live official routes.
                  </div>
                </div>
                <div className="settings-reference-mini-metric">
                  <div className="settings-reference-mini-metric__label">Suppliers Online</div>
                  <div className="settings-reference-mini-metric__value">
                    {activeProviders}/{thirdPartyProviders.length}
                  </div>
                  <div className="settings-reference-mini-metric__helper">
                    Third-party suppliers currently ready for traffic.
                  </div>
                </div>
                <div className="settings-reference-mini-metric">
                  <div className="settings-reference-mini-metric__label">Budget Policies</div>
                  <div className="settings-reference-mini-metric__value">{budgetCount}</div>
                  <div className="settings-reference-mini-metric__helper">
                    Endpoints with amount or token caps configured.
                  </div>
                </div>
                <div className="settings-reference-mini-metric">
                  <div className="settings-reference-mini-metric__label">Attention Queue</div>
                  <div className="settings-reference-mini-metric__value">{attentionCount}</div>
                  <div className="settings-reference-mini-metric__helper">
                    Paused, invalid, or rate-limited channels awaiting review.
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <SegmentedControl
                  options={[
                    { value: 'official', label: 'Official Routes' },
                    { value: 'third-party', label: 'Suppliers' },
                  ]}
                  value={activeTab}
                  onChange={(value) => setActiveTab(value as TabType)}
                />
              </div>
            </section>

            <section className="settings-reference-card">
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__eyebrow">Global Latency Matrix</div>
                  <div className="settings-reference-card__title">Fastest Endpoints</div>
                  <div className="settings-reference-card__meta">
                    Recent latencies across each route type.
                  </div>
                </div>
                <Clock3 size={18} className="text-[var(--text-primary)]" />
              </div>

              <div className="mt-5 settings-latency-matrix">
                {latencyCards.length > 0 ? (
                  latencyCards.map((item, index) => (
                    <div key={item.id} className="settings-latency-matrix__item">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                          Rank {index + 1}
                        </div>
                        <div className="mt-1 truncate text-[15px] font-semibold text-[var(--text-primary)]">
                          {item.label}
                        </div>
                        <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{item.helper}</div>
                      </div>
                      <div className="settings-latency-matrix__value">{formatLatency(item.latency)}</div>
                    </div>
                  ))
                ) : (
                  <div className="settings-reference-mini-metric">
                    <div className="settings-reference-mini-metric__label">No Probe Data</div>
                    <div className="settings-reference-mini-metric__helper">
                      Run refresh on any card to populate latency and model sync info.
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="settings-reference-card settings-reference-card--soft">
            <div className="settings-reference-toolbar">
              <div>
                <div className="settings-reference-card__eyebrow">
                  {activeTab === 'official' ? 'Official Route Grid' : 'Supplier Grid'}
                </div>
                <div className="settings-reference-card__title">
                  {activeTab === 'official' ? 'Production-grade direct channels' : 'Expandable supplier network'}
                </div>
              </div>
              <div className="settings-reference-toolbar__meta">
                <SettingsBadge tone={activeTab === 'official' ? 'indigo' : 'emerald'}>
                  {activeTab === 'official' ? 'Official View' : 'Supplier View'}
                </SettingsBadge>
                <SettingsBadge tone="neutral">{connectedChannels} active channels</SettingsBadge>
              </div>
            </div>
          </section>

          {activeTab === 'official' ? (
            officialSlots.length === 0 ? (
              <section className="settings-reference-card">
                <EmptyState
                  title="No official route has been added yet"
                  description="Connect an OpenAI or Gemini official route first, then it will appear in the shared endpoint grid."
                  action={
                    <SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateOfficial}>
                      Add Official Route
                    </SettingsActionButton>
                  }
                />
              </section>
            ) : (
              <div className="settings-provider-grid">
                {officialSlots.map((slot) => {
                  const mode = getMode(slot.budgetLimit, slot.tokenLimit);
                  const status = getOfficialStatus(slot);
                  const progress = getProgress(
                    mode,
                    mode === 'amount' ? slot.totalCost : slot.usedTokens || 0,
                    slot.budgetLimit,
                    slot.tokenLimit
                  );

                  return (
                    <ConsoleEndpointCard
                      key={slot.id}
                      avatar={
                        <div className="settings-provider-card__avatar" style={{ color: 'rgb(var(--settings-accent-rgb))' }}>
                          <Shield size={18} />
                        </div>
                      }
                      title={slot.name || getOfficialProviderLabel(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google')}
                      subtitle={slot.provider === 'OpenAI' ? 'OpenAI official route' : 'Google Gemini official route'}
                      activityLine={`Key preview: ${maskSecret(slot.key)}`}
                      badges={
                        <>
                          <SettingsBadge tone={status.badge}>{status.label}</SettingsBadge>
                          <SettingsBadge tone="neutral">Official</SettingsBadge>
                        </>
                      }
                      metrics={[
                        {
                          label: 'Budget',
                          value: getModeLabel(mode),
                          helper: getLimitValueLabel(mode, mode === 'amount' ? slot.budgetLimit : slot.tokenLimit),
                        },
                        {
                          label: 'Spend',
                          value: mode === 'tokens' ? formatTokens(slot.usedTokens || 0) : formatUsd(slot.totalCost),
                          helper: getOfficialUsageSummary(slot),
                        },
                        {
                          label: 'Models',
                          value: `${slot.supportedModels.length}`,
                          helper:
                            slot.supportedModels.length > 0
                              ? 'Auto-detected model list is already attached.'
                              : 'Refresh the route to detect available models.',
                        },
                        {
                          label: 'Latency',
                          value: formatLatency(slot.lastResponseTime ?? slot.avgResponseTime ?? null),
                          helper: formatDateTime(slot.lastUsed || slot.updatedAt || slot.createdAt),
                        },
                      ]}
                      progress={mode !== 'unlimited' ? progress : undefined}
                      progressLabel={getOfficialUsageSummary(slot)}
                      progressTone={progress >= 90 ? 'rose' : progress >= 70 ? 'amber' : 'indigo'}
                      error={slot.lastError || undefined}
                      actions={
                        <>
                          <SettingsActionButton icon={Edit3} size="sm" onClick={() => startEditOfficial(slot)}>
                            Edit
                          </SettingsActionButton>
                          <SettingsActionButton
                            icon={RefreshCw}
                            size="sm"
                            loading={busy === `official-check:${slot.id}`}
                            onClick={() => void refreshOfficial(slot)}
                          >
                            Refresh
                          </SettingsActionButton>
                          <SettingsActionButton
                            icon={slot.disabled ? Play : Pause}
                            size="sm"
                            onClick={() => void toggleOfficial(slot)}
                          >
                            {slot.disabled ? 'Enable' : 'Pause'}
                          </SettingsActionButton>
                        </>
                      }
                    />
                  );
                })}
              </div>
            )
          ) : thirdPartyProviders.length === 0 ? (
            <section className="settings-reference-card">
              <EmptyState
                title="No supplier has been added yet"
                description="Add a third-party supplier to bring alternative routes, custom protocols, or price sync into the grid."
                action={
                  <SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateProvider}>
                    Add Supplier
                  </SettingsActionButton>
                }
              />
            </section>
          ) : (
            <div className="settings-provider-grid">
              {thirdPartyProviders.map((provider) => {
                const mode = getMode(provider.budgetLimit, provider.tokenLimit, provider.customCostMode || 'unlimited');
                const status = getProviderStatus(provider);
                const progress = getProgress(
                  mode,
                  mode === 'amount' ? provider.usage.totalCost : provider.usage.totalTokens,
                  provider.budgetLimit,
                  provider.tokenLimit
                );

                return (
                  <ConsoleEndpointCard
                    key={provider.id}
                    avatar={
                      <div className="settings-provider-card__avatar" style={{ color: provider.providerColor || '#60A5FA' }}>
                        {provider.name.charAt(0).toUpperCase()}
                      </div>
                    }
                    title={provider.name}
                    subtitle={extractDomain(provider.baseUrl)}
                    activityLine={getProviderActivityLine(provider)}
                    badges={
                      <>
                        <SettingsBadge tone={status.badge}>{status.label}</SettingsBadge>
                        {provider.group ? <SettingsBadge tone="neutral">{provider.group}</SettingsBadge> : null}
                      </>
                    }
                    metrics={[
                      {
                        label: 'Protocol',
                        value: getProtocolLabel(provider.format),
                        helper: 'Controls request shape, model discovery, and route compatibility.',
                      },
                      {
                        label: 'Budget',
                        value: getModeLabel(mode),
                        helper: getLimitValueLabel(mode, mode === 'amount' ? provider.budgetLimit : provider.tokenLimit),
                      },
                      {
                        label: 'Models',
                        value: `${provider.models.length}`,
                        helper:
                          provider.models.length > 0
                            ? 'Detected models are already attached to the supplier.'
                            : 'Save and refresh to sync model availability.',
                      },
                      {
                        label: 'Latency',
                        value: formatLatency(provider.activitySummary?.lastLatencyMs ?? null),
                        helper: formatDateTime(provider.lastChecked || provider.updatedAt),
                      },
                    ]}
                    progress={mode !== 'unlimited' ? progress : undefined}
                    progressLabel={getProviderUsageSummary(provider)}
                    progressTone={progress >= 90 ? 'rose' : progress >= 70 ? 'amber' : 'indigo'}
                    error={provider.lastError}
                    actions={
                      <>
                        <SettingsActionButton icon={Edit3} size="sm" onClick={() => startEditProvider(provider)}>
                          Edit
                        </SettingsActionButton>
                        <SettingsActionButton
                          icon={RefreshCw}
                          size="sm"
                          loading={busy === `provider-check:${provider.id}`}
                          onClick={() => void refreshProvider(provider)}
                        >
                          Refresh
                        </SettingsActionButton>
                        <SettingsActionButton
                          icon={Wand2}
                          size="sm"
                          loading={busy === `provider-price:${provider.id}`}
                          onClick={() => void syncPricing(provider)}
                        >
                          Sync Pricing
                        </SettingsActionButton>
                        <SettingsActionButton
                          icon={provider.isActive ? Pause : Play}
                          size="sm"
                          onClick={() => void toggleProvider(provider)}
                        >
                          {provider.isActive ? 'Pause' : 'Enable'}
                        </SettingsActionButton>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : null`;
const replaced = data.slice(0, start) + newBlock + data.slice(end + endMarker.length);
fs.writeFileSync('temp_ApiSettingsView.tsx', replaced);
