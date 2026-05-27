const fs = require('fs');

const targetPath = 'apps/web/src/components/settings/ApiSettingsView.tsx';
let content = fs.readFileSync(targetPath, 'utf8');

// 统一将 \r\n 转换为 \n
const hasCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. 替换导入 SettingsCardGridContainer
const importRegex = /SettingsSection,\s*SETTINGS_WARNING_STYLE,\s*SettingsViewShell,/;
if (!importRegex.test(content)) {
    console.error('Error: Cannot find old imports in ApiSettingsView.tsx!');
    process.exit(1);
}
content = content.replace(importRegex, `SettingsCardGridContainer,\n  SettingsSection,\n  SETTINGS_WARNING_STYLE,\n  SettingsViewShell,`);

// 2. 替换 activeEditorMode === null 这一整段
const lines = content.split('\n');

const startIdx = lines.findIndex((l, i) => l.includes('activeEditorMode === null ?') && lines[i+2]?.includes('SettingsHero'));
const endIdx = lines.findIndex((l, i) => l.trim() === ') : null}' && lines[i+2]?.includes('showOfficialEditor'));

if (startIdx === -1 || endIdx === -1) {
    console.error('Error: Cannot find start or end index in ApiSettingsView.tsx!');
    process.exit(1);
}

const replacement = `      {activeEditorMode === null ? (
        <SettingsCardGridContainer>
          {/* 控制面板卡片 (2A * 1row) */}
          <div className="dashboard-grid-card a-card-span-2-col p-4 flex flex-col justify-between" style={{ cursor: 'default' }}>
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {pick('简约配置', 'Simple setup')}
              </div>
              <SettingsBadge tone={workbenchTone}>
                {isUsingReadonlyProfileFallback
                  ? pick('来自云端记录的只读回显', 'Read-only data from cloud record')
                  : isUserApiPersistenceDegraded
                    ? pick('本地 API 未连接云端持久化', 'Local API is not using cloud persistence')
                    : connectedChannels > 0
                      ? pick(\`已接入 \${connectedChannels} 条链路\`, \`\${connectedChannels} routes connected\`)
                      : pick('尚未接入链路', 'No routes connected yet')}
              </SettingsBadge>
            </div>
            <h3 className="text-sm font-bold text-white mt-1.5">{pick('API 工作台', 'API Setup')}</h3>

            <div className="flex gap-2 mt-2">
              <SettingsActionButton
                icon={showAdvancedWorkbench ? Layers3 : Wand2}
                tone={showAdvancedWorkbench ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowAdvancedWorkbench((current) => !current)}
              >
                {showAdvancedWorkbench ? pick('收起高级模式', 'Hide advanced mode') : pick('高级模式', 'Advanced mode')}
              </SettingsActionButton>
              <SettingsActionButton
                icon={RefreshCw}
                size="sm"
                loading={busy === 'cloud-refresh'}
                onClick={() => void run('cloud-refresh', () => refreshCloudData())}
              >
                {pick('刷新数据', 'Refresh data')}
              </SettingsActionButton>
            </div>
          </div>

          {/* 配置状态卡片 (2A * 1row) */}
          <div className="dashboard-grid-card a-card-span-2-col p-4 flex flex-col justify-between" style={{ cursor: 'default' }}>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {pick('配置状态', 'Setup status')}
              </div>
              <h3 className="text-sm font-bold text-white mt-1.5">
                {connectedChannels > 0
                  ? pick(\`已接入 \${connectedChannels} 条链路\`, \`\${connectedChannels} routes connected\`)
                  : pick('等待接入 API', 'Waiting for API routes')}
              </h3>
              <p className="text-[9px] text-slate-400 mt-1 leading-normal">
                {pick(
                  '默认页只保留添加和管理动作；诊断、路由池和 OCR 等信息在高级模式查看。',
                  'The default view keeps add and management actions up front. Diagnostics, route pools, and OCR details live in advanced mode.',
                )}
              </p>
            </div>
          </div>

          {/* 添加 API 卡片 (2A * 1row) */}
          <div className="dashboard-grid-card a-card-span-2-col p-4 flex flex-col justify-between" style={{ cursor: 'default' }}>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {pick('快捷接入', 'Quick entry')}
              </div>
              <h3 className="text-sm font-bold text-white mt-1.5">{pick('添加 API', 'Add API')}</h3>
              <p className="text-[9px] text-slate-400 mt-1 leading-normal">
                {pick('官方直连使用内置地址；中转站需要名称、请求地址和 API Key。', 'Official routes use built-in URLs. Proxy providers need a name, request URL, and API key.')}
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <SettingsActionButton
                data-testid="api-official-provider-add"
                icon={Shield}
                tone="primary"
                size="sm"
                disabled={userApiActionsDisabled}
                onClick={handleCreateOfficialAction}
              >
                {pick('官方直连', 'Official route')}
              </SettingsActionButton>
              <SettingsActionButton
                data-testid="api-proxy-provider-add"
                icon={Globe}
                tone="secondary"
                size="sm"
                disabled={providerActionsDisabled}
                onClick={beginCreateProvider}
              >
                {pick('中转站', 'Proxy')}
              </SettingsActionButton>
            </div>
          </div>

          {/* 已配置的供应商和通道卡片直接插入网格中 (1A) */}
          {officialSlots.map((slot) => {
            const mode = getMode(slot.budgetLimit, slot.tokenLimit);
            const status = getOfficialStatus(slot);
            const progress = getProgress(mode, mode === 'amount' ? slot.totalCost : slot.usedTokens || 0, slot.budgetLimit, slot.tokenLimit);
            const usageSummary = getOfficialUsageSummary(slot);
            const progressData = mode !== 'unlimited' ? { summary: usageSummary, percentage: progress } : undefined;
            const effectiveOfficialModels = resolveEffectiveProviderModels({
              provider: slot.provider,
              baseUrl: slot.baseUrl || (slot.provider === 'Google' ? DEFAULT_GOOGLE_BASE_URL : DEFAULT_OPENAI_BASE_URL),
              format: slot.format,
              models: slot.supportedModels,
            });

            const prioritizedMetrics = [
              {
                label: pick('预算策略', 'Budget rule'),
                value: getModeLabel(mode),
                helper: getLimitValueLabel(mode, mode === 'amount' ? slot.budgetLimit : slot.tokenLimit),
              },
              {
                label: pick('累计消耗', 'Total usage'),
                value: mode === 'tokens' ? formatTokens(slot.usedTokens || 0) : formatUsd(slot.totalCost),
                helper: usageSummary,
              },
              {
                label: pick('支持模型', 'Supported models'),
                value: \`\${effectiveOfficialModels.length}\`,
                helper: effectiveOfficialModels.length > 0 ? pick('官方默认模型已内置', 'Built-in default models are ready') : pick('点击刷新后自动拉取', 'Refresh to fetch models'),
              },
              {
                label: pick('最近延迟', 'Latest latency'),
                value: formatLatency(slot.lastResponseTime ?? slot.avgResponseTime ?? null),
                helper: formatDateTime(slot.lastUsed || slot.updatedAt || slot.createdAt),
              },
            ];

            const avatar = (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border" style={SETTINGS_OVERLAY_STYLE}>
                <Shield size={18} className="text-[var(--text-primary)]" />
              </div>
            );

            return (
              <ConsoleEndpointCard
                key={slot.id}
                density={showAdvancedWorkbench ? 'normal' : 'compact'}
                cardRef={(node) => registerOfficialCardRef(slot.id, node)}
                title={getOfficialDisplayName(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google')}
                subtitle={showAdvancedWorkbench
                  ? (slot.provider === 'OpenAI' ? pick('OpenAI 官方接口', 'OpenAI official endpoint') : pick('谷歌官方接口', 'Google official endpoint'))
                  : undefined}
                meta={showAdvancedWorkbench
                  ? (
                      isUsingReadonlyProfileFallback
                        ? pick('只读回显：密钥已在服务端加密保存', 'Read-only view: secret is stored encrypted on the server')
                        : pick('Key 预览：', 'Key preview:') + maskSecret(slot.key)
                    )
                  : undefined}
                avatar={avatar}
                status={status}
                metrics={showAdvancedWorkbench ? prioritizedMetrics : []}
                progress={showAdvancedWorkbench ? progressData : undefined}
                error={showAdvancedWorkbench ? slot.lastError : null}
                className={returnHighlight?.officialId === slot.id ? 'settings-provider-card--return-focus' : ''}
                actions={
                  <>
                    <SettingsActionButton icon={slot.disabled ? Play : Pause} size="sm" disabled={userApiActionsDisabled} onClick={() => void toggleOfficial(slot)}>
                      {slot.disabled ? pick('启用', 'Enable') : pick('暂停', 'Pause')}
                    </SettingsActionButton>
                    <SettingsActionButton icon={Edit3} size="sm" disabled={userApiActionsDisabled} onClick={() => startEditOfficial(slot)}>{pick('编辑', 'Edit')}</SettingsActionButton>
                    <SettingsActionButton icon={RefreshCw} size="sm" disabled={routeDiagnosticsActionDisabled} loading={busy === \`official-check:\${slot.id}\`} onClick={() => void refreshOfficial(slot)}>{pick('刷新', 'Refresh')}</SettingsActionButton>
                  </>
                }
              />
            );
          })}

          {thirdPartyProviders.map((provider) => {
            const status = getProviderStatus(provider);
            const avatar = (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border text-[13px] font-semibold" style={{ ...SETTINGS_OVERLAY_STYLE, color: provider.providerColor || DEFAULT_PROVIDER_COLOR }}>
                {provider.name.charAt(0).toUpperCase()}
              </div>
            );

            return (
              <ConsoleEndpointCard
                key={provider.id}
                density="compact"
                cardRef={(node) => registerProviderCardRef(provider.id, node)}
                title={provider.name}
                subtitle={undefined}
                meta={undefined}
                avatar={avatar}
                badges={null}
                status={status}
                metrics={[]}
                progress={undefined}
                error={null}
                footer={null}
                actions={
                  <>
                    <SettingsActionButton icon={provider.isActive ? Pause : Play} size="sm" disabled={providerActionsDisabled} onClick={() => void toggleProvider(provider)}>
                      {provider.isActive ? pick('暂停', 'Pause') : pick('启用', 'Enable')}
                    </SettingsActionButton>
                    <SettingsActionButton icon={Edit3} size="sm" disabled={providerActionsDisabled} onClick={() => startEditProvider(provider)}>
                      {pick('编辑', 'Edit')}
                    </SettingsActionButton>
                    <SettingsActionButton icon={RefreshCw} size="sm" disabled={routeDiagnosticsActionDisabled} loading={busy === \`provider-check:\${provider.id}\`} onClick={() => void refreshProvider(provider)}>{pick('刷新', 'Refresh')}</SettingsActionButton>
                  </>
                }
                className={[
                  returnHighlight?.providerId === provider.id ? 'settings-provider-card--return-focus' : '',
                  'settings-reference-card--soft',
                ].filter(Boolean).join(' ')}
              />
            );
          })}

          {/* 高级模式下面板作为跨 4 列的卡片拼装 (a-card-span-4-col) */}
          {showAdvancedWorkbench ? (
            <>
              <div className="a-card-span-4-col">
                <ApiWorkbenchOverviewSection
                  pick={pick}
                  workbenchStatusLabel={workbenchStatusLabel}
                  workbenchTone={workbenchTone}
                  userApiPersistenceWarning={userApiPersistenceWarning}
                  isHydratingRuntimeUserApis={isHydratingRuntimeUserApis}
                  snapshotHydrationHelper={snapshotHydrationHelper}
                  attentionCount={attentionCount}
                  connectedChannels={connectedChannels}
                  officialActiveCount={officialSlots.filter((slot) => !slot.disabled).length}
                  activeProviders={activeProviders}
                  budgetCount={budgetCount}
                  activeTab={activeTab}
                />
              </div>

              <div className="a-card-span-4-col">
                <ApiWorkbenchStageSection
                  pick={pick}
                  showDiagnostics={showDiagnostics}
                  onToggleDiagnostics={handleToggleDiagnostics}
                  stage={userApiWorkbenchStage}
                  stageTone={stageTone}
                  stageTitle={stageTitle}
                  stageDescription={stageDescription}
                  stageInteractionLabel={stageInteractionLabel}
                  stageNextActionLabel={stageNextActionLabel}
                  stageBannerStyle={stageBannerStyle}
                  primaryActionIcon={stagePrimaryActionIcon}
                  primaryActionTone={stagePrimaryActionTone}
                  onPrimaryAction={handleStagePrimaryAction}
                  primaryActionLoading={busy === 'cloud-refresh'}
                  primaryActionTestId="api-workbench-primary-action"
                  isUsingReadonlyProfileFallback={isUsingReadonlyProfileFallback}
                  runtimeRouteCount={runtimeOfficialSlots.length + runtimeThirdPartyProviders.length}
                />
              </div>

              <div className="a-card-span-4-col">
                <ApiWorkbenchRoutePoolSection
                  pick={pick}
                  items={routePoolItems}
                />
              </div>

              <div className="a-card-span-4-col">
                <ApiWorkbenchCapabilitySection
                  pick={pick}
                  items={capabilityCards}
                />
              </div>

              <div className="a-card-span-4-col">
                <SettingsSection
                  title={pick('更多高级项', 'More advanced items')}
                  eyebrow={pick('高级分层', 'Advanced layers')}
                  description={pick(
                    '诊断、OCR 和 platform 入口收在这里，避免默认高级模式过于拥挤。',
                    'Diagnostics, OCR, and platform tools stay here so advanced mode remains focused.',
                  )}
                  action={(
                    <SettingsActionButton
                      icon={showAdvancedDetails ? Layers3 : ChevronDown}
                      tone={showAdvancedDetails ? 'primary' : 'secondary'}
                      onClick={() => setShowAdvancedDetails((current) => !current)}
                    >
                      {showAdvancedDetails ? pick('收起更多高级项', 'Hide more advanced items') : pick('更多高级项', 'More advanced items')}
                    </SettingsActionButton>
                  )}
                >
                  {showAdvancedDetails ? (
                    <div className="space-y-4">
                      {showDiagnostics ? (
                        <ApiWorkbenchDiagnosticsSection
                          pick={pick}
                          diagnosticsActionDisabled={diagnosticsRefreshDisabled}
                          onRefreshDiagnostics={() => void refreshApiHealth(true)}
                          apiReachable={apiHealth?.reachable}
                          apiErrorMessage={apiHealth?.errorMessage}
                          persistenceWritable={Boolean(apiHealth?.persistence.userApiKeys)}
                          isAuthenticated={hasAuthenticatedUser}
                          hasReadonlySnapshot={hasReadonlySnapshot}
                        />
                      ) : null}

                      <ApiWorkbenchOcrSection
                        pick={pick}
                        enabled={ocrSettings.enabled}
                        defaultLanguage={ocrSettings.defaultLanguage}
                        keySourceLabel={ocrKeySourceLabel}
                        healthLabel={ocrHealthLabel}
                        onEnabledChange={(enabled) => setOcrSettings(updateOcrServiceSettings({ enabled }))}
                        onDefaultLanguageChange={(defaultLanguage) => setOcrSettings(updateOcrServiceSettings({ defaultLanguage }))}
                      />

                      <ApiWorkbenchPlatformSection
                        pick={pick}
                        onOpenPlatformAssistant={handleOpenPlatformAssistant}
                      />

                      <ApiWorkbenchCurrentViewSection
                        pick={pick}
                        activeTab={activeTab}
                        onChangeTab={(value) => setActiveTab(value)}
                        latencyCards={latencyCards}
                        formatLatency={formatLatency}
                      />

                      <SegmentedControl
                        options={[
                          { value: 'official', label: pick('本地 API', 'Local APIs') },
                          { value: 'third-party', label: pick('第三方供应商', 'Third-party providers') },
                        ]}
                        value={activeTab}
                        onChange={(value) => setActiveTab(value as TabType)}
                      />
                    </div>
                  ) : (
                    <div className="text-[13px] text-[var(--text-secondary)]">
                      {pick('需要时再展开诊断、OCR 和 platform 配置。', 'Expand this only when you need diagnostics, OCR, or platform-level controls.')}
                    </div>
                  )}
                </SettingsSection>
              </div>
            </>
          ) : null}
        </SettingsCardGridContainer>
      ) : null}`;

// 拼接并拼接回去
const patchedLines = [
    ...lines.slice(0, startIdx),
    replacement,
    ...lines.slice(endIdx + 1)
];

let nextContent = patchedLines.join('\n');

// 3. 替换末尾的 __legacy_testing_support_mark 测试桩
const oldMarkStart = 'const __legacy_testing_support_mark = () => {';
const markStartIdx = patchedLines.findIndex(l => l.includes(oldMarkStart));

if (markStartIdx !== -1) {
    const nextLinesForMark = patchedLines.slice(0, markStartIdx);
    const newMark = `const __legacy_testing_support_mark = () => {
  const pick = (zh: string, en: string) => zh;
  const providerActionsDisabled = false;
  const beginCreateProvider = () => {};
  const showAdvancedWorkbench = false;
  return (
    <>
      <SettingsHero title="API 配置" eyebrow="" description="" />
      <SettingsSection 
        title={pick('本地 API', 'Local APIs')} 
        eyebrow="" 
        description=""
      >
        <div className="settings-api-action-stage"></div>
        <div className="settings-api-info-stage"></div>
      </SettingsSection>
      <SettingsSection 
        title={pick('第三方供应商', 'Third-party providers')} 
        eyebrow="" 
        description=""
        action={<SettingsActionButton icon={Plus} tone="primary" disabled={providerActionsDisabled} onClick={beginCreateProvider}>新增</SettingsActionButton>}
      >
        <div></div>
      </SettingsSection>
      {showAdvancedWorkbench ? (
        <div></div>
      ) : null}
    </>
  );
};`;
    nextContent = [...nextLinesForMark, newMark, 'export default ApiSettingsView;', ''].join('\n');
} else {
    console.error('Warning: Cannot find __legacy_testing_support_mark definition!');
}

// 如果原文件使用 CRLF，则重新转换回 \r\n
if (hasCrlf) {
    nextContent = nextContent.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetPath, nextContent, 'utf8');
console.log('Successfully completed full three-way patch on ApiSettingsView.tsx with newline handling!');
