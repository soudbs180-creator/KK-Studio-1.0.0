export const DEFAULT_LANGUAGE = 'zh-CN';
export const LANGUAGE_STORAGE_KEY = 'kk_language';

export type ResolvedLanguage = 'zh-CN' | 'en-US';

export const normalizeLanguage = (value?: string | null): ResolvedLanguage => {
  if (!value) return DEFAULT_LANGUAGE;
  return value.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
};

export const pickByResolvedLanguage = <T,>(language: ResolvedLanguage, zh: T, en: T): T =>
  language === DEFAULT_LANGUAGE ? zh : en;

export const getDocumentLanguage = (): ResolvedLanguage => {
  let storedLanguage: ResolvedLanguage | null = null;
  if (typeof window !== 'undefined') {
    try {
      const rawStoredLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      storedLanguage = rawStoredLanguage ? normalizeLanguage(rawStoredLanguage) : null;
    } catch {
      storedLanguage = null;
    }
  }

  if (typeof document !== 'undefined') {
    const { documentElement } = document;
    return normalizeLanguage(
      documentElement.dataset.language
      || storedLanguage
      || documentElement.lang
      || null
    );
  }

  if (storedLanguage) {
    return storedLanguage;
  }

  return DEFAULT_LANGUAGE;
};

export const isChineseDocumentLanguage = () => getDocumentLanguage() === DEFAULT_LANGUAGE;

export const pickByDocumentLanguage = <T,>(zh: T, en: T): T =>
  pickByResolvedLanguage(getDocumentLanguage(), zh, en);

const EXACT_TRANSLATION_PAIRS: Array<[string, string]> = [
  ['Application Error', '应用错误'],
  ['Something went wrong. Please refresh the page.', '页面发生异常，请刷新后重试。'],
  ['Reload Page', '刷新页面'],
  ['Deck updated', '页面包已更新'],
  ['Timed out while waiting for Turnstile', '等待 Turnstile 组件加载超时。'],
  ['Failed to load Turnstile script', 'Turnstile 脚本加载失败。'],
  ['WeChat login widget can only run in the browser.', '微信登录组件只能在浏览器环境中运行。'],
  ['WeChat login widget is unavailable after the script finished loading.', '微信登录组件脚本加载完成后仍不可用。'],
  ['Unable to load the official WeChat login widget.', '无法加载微信官方登录组件。'],
  ['WeChat login widget mount point is unavailable.', '微信登录组件挂载节点不可用。'],
  ['Fetch failed', '获取资源失败。'],
  ['Not an image', '获取到的内容不是图片。'],
  ['Unsupported storage format', '不支持的存储格式。'],
  ['Cloud fetch failed', '云端资源获取失败。'],
  ['No image data found', '未找到图片数据。'],
  ['Fallback fetch failed', '回退资源获取失败。'],
  ['Planner returned invalid JSON', '规划器返回了无效的 JSON 数据。'],
  ['Could not find root element to mount to', '未找到应用挂载根节点。'],
  ['useLocale must be used within a LocaleProvider', 'useLocale 必须在 LocaleProvider 内使用。'],
  ['useOnboarding must be used within OnboardingProvider', 'useOnboarding 必须在 OnboardingProvider 内使用。'],
  ['INVALID_LIGHTBOX_SOURCE', '图片预览源无效。'],
  ['ORIGINAL_BLOB_UNAVAILABLE', '原始图片数据不可用。'],
  ['INVALID_IMAGE_DATA_FORMAT', '图片数据格式无效。'],
  ['Sign in required', '请先登录'],
  ['Checking account status', '账户状态确认中'],
  ['Syncing balance', '余额同步中'],
  ['Generation failed', '生成失败'],
  ['Image added', '图片已添加'],
  ['Image processing failed', '图片处理失败'],
  ['Export complete', '导出完成'],
  ['Content is empty', '内容为空'],
  ['Page copy updated', '页面文案已更新'],
  ['Duplicate request blocked', '已拦截重复发送'],
  ['Prompt optimization failed', '提示词优化失败'],
  ['Send failed', '发送失败'],
  ['Unable to add image', '无法添加图片'],
  ['Detached', '已断开连接'],
  ['Pinned', '已固定'],
  ['Idea captured', '想法已定格'],
  ['History restored', '恢复历史结果'],
  ['Generation complete', '生成完成'],
  ['Retry failed', '重试失败'],
  ['No pages available to export', '无可导出页面'],
  ['Page not found', '页面不存在'],
  ['Single-page redraw complete', '单页重绘完成'],
  ['Single-page redraw failed', '单页重绘失败'],
  ['Export failed', '导出失败'],
  ['PPTX export complete', 'PPTX 导出完成'],
  ['Tasks restored', '恢复任务'],
  ['Migration complete', '迁移成功'],
  ['Connection successful', '连接成功'],
  ['Connection failed', '连接失败'],
  ['Save failed', '保存失败'],
  ['Detection failed', '检测失败'],
  ['Notice', '提示'],
  ['Copy failed', '复制失败'],
  ['Import successful', '导入成功'],
  ['Import failed', '导入失败'],
  ['Enter System Access Token', '请输入 System Access Token'],
  ['Switch failed', '切换失败'],
  ['Switch successful', '切换成功'],
  ['Enter API Key', '请输入 API Key'],
  ['Enter Base URL', '请输入 Base URL'],
  ['Insufficient credits', '积分不足'],
  ['Access token verification failed', '访问令牌验证失败'],
  ['Access token verified', '访问令牌验证成功'],
  ['System Access Token not required', '无需 System Access Token'],
  ['Download failed', '下载失败'],
  ['Download successful', '下载成功'],
  ['Load failed', '加载失败'],
  ['Cleanup complete', '清理完成'],
  ['Timed cleanup complete', '按时间清理完成'],
  ['Merge complete', '合并完成'],
  ['Merge failed', '合并失败'],
  ['Organization complete', '整理完成'],
  ['Organization failed', '整理失败'],
  ['Authorization incomplete', '未完成授权'],
  ['Download started', '下载已开始'],
  ['Cleared', '已清空'],
  ['Move failed', '移动失败'],
  ['Created successfully', '创建成功'],
  ['Sync complete', '同步完成'],
  ['Sync failed', '同步失败'],
  ['Prompt inserted', '提示词已插入'],
  ['Cancelled', '已取消'],
  ['Syncing images', '正在同步图片'],
  ['Skipped duplicate reference images', '已跳过重复参考图'],
  ['Storage preference updated', '存储设置成功'],
  ['No images', '无图片'],
  ['Exporting', '导出中'],
  ['Switched to temporary mode', '已切换到临时模式'],
  ['Missing fields', '缺少字段'],
  ['Invalid model', '模型无效'],
  ['Missing API key', '缺少 接口密钥'],
  ['Saved keys cannot be edited', '无法修改已保存密钥'],
  ['Cloud sync unavailable', '云同步不可用'],
  ['Top-up successful', '充值成功'],
  ['Top-up unavailable', '充值暂不可用'],
  ['Failed to create top-up order', '创建充值订单失败'],
  ['Unable to save settings.', '无法保存设置'],
  ['Browser unsupported', '浏览器不支持'],
  ['Your browser does not support the File System Access API. Please use the latest Chrome, Edge, or another supported browser.', '您的浏览器不支持文档系统访问API。请使用最新版Chrome、Edge或支持的浏览器。'],
  ['WeChat Pay is under maintenance', '微信支付维护中'],
  ['International payments are under maintenance', '国际支付维护中'],
  ['Order created', '订单已创建'],
  ['Scan the QR code or open the payment link to finish payment. Your balance will refresh automatically after settlement.', '请扫码或打开支付链接完成支付，到账后会自动刷新余额。'],
  ['Online payment is currently unavailable. Please contact an administrator.', '当前暂未开放在线支付，请联系管理员处理。'],
  ['Credits have been synced to your balance.', '积分已同步到余额。'],
  ['Export successful', '导出成功'],
  ['Delete successful', '删除成功'],
  ['Refresh successful', '刷新成功'],
  ['Refresh failed', '刷新失败'],
  ['Update successful', '更新成功'],
  ['Added successfully', '添加成功'],
  ['Sign-in successful', '登录成功'],
  ['Sign-in failed', '登录失败'],
  ['Your balance is too low. Please recharge credits first.', '您的账户余额不足，请先充值积分。'],
  ['Checking your sign-in status. Please try again in a moment.', '正在校验登录状态，请稍后再试。'],
  ['Refreshing your balance. Please try again shortly.', '正在刷新账户余额，请稍后重试。'],
  ['Credit-based models require a signed-in full account.', '积分模型需要登录正式账号后使用。'],
  ['Admin-configured credit models require a signed-in account before they can spend credits.', '管理员配置的积分模型需要登录账号后使用积分调用。'],
  ['Please try again.', '请重试'],
  ['Please try again later.', '请稍后重试'],
  ['Regeneration succeeded', '重新生成成功'],
  ['Enter a title or description for the current page.', '请输入当前页面的标题或描述'],
  ['The current main card has not generated any child pages yet.', '当前主卡还没有生成副卡页面'],
  ['Incorrect email or password.', '请检查账号和密码。'],
  ['Network error. Please try again later.', '网络异常，请稍后重试。'],
  ['Unknown error', '未知错误'],
  ['Credits have been synced to your balance.', '积分已同步到余额。'],
  ['Sign in before creating a top-up order.', '登录后才能发起充值。'],
  ['No enabled top-up currency is available right now. Please try again later or contact an administrator.', '当前没有启用中的充值币种，请稍后重试或联系管理员。'],
  ['Provider name cannot be empty.', '供应商名称不能为空。'],
  ['Base URL cannot be empty.', 'Base URL 不能为空。'],
  ['API Key cannot be empty.', 'API Key 不能为空。'],
  ['The configuration has been saved.', '配置已经保存。'],
  ['The new configuration has been saved.', '新配置已经保存。'],
  ['This provider can fetch model information directly from the public catalog.', '该供应商可直接从公开目录获取模型信息'],
  ['Enter the System Access Token before verifying.', '请先填写 System Access Token 后再进行验证。'],
  ['You can now continue fetching model and pricing information.', '现在可以继续获取模型和价格信息。'],
  ['Check whether the access token is correct.', '请检查访问令牌是否正确。'],
  ['Check the network and access token configuration.', '请检查网络和访问令牌配置。'],
  ['Enter the System Access Token first.', '请先填写 System Access Token。'],
  ['Check the base URL and credential configuration.', '请检查地址和凭据配置。'],
  ['Name is required.', '名称为必填项。'],
  ['API Key is required.', 'API Key 为必填项。'],
  ['Proxy and third-party configurations must include a full API URL (we recommend including /v1).', '代理或第三方配置必须填写完整接口地址（建议包含 /v1）。'],
  ['The API configuration has been updated.', '接口配置已更新。'],
  ['The API configuration has been saved.', '接口配置已保存。'],
  ['Name, URL, and key are all required.', '名称、地址和密钥都是必填项'],
  ['Falling back to standard API mode.', '将使用标准 API 模式'],
  ['The provider has been removed.', '服务商已移除'],
  ['Click "Refresh data" to fetch the latest management data.', '点击"刷新数据"按钮获取最新管理数据'],
  ['Latest pricing is temporarily unavailable. The current page has been opened for you instead.', '暂时无法获取最新定价，已为你打开当前页面'],
  ['This provider has no management API configured and there is no cached pricing data locally.', '当前供应商未配置管理 API，且本地没有缓存的定价信息'],
  ['Configure the access token first.', '请先配置 Access Token'],
  ['Fetching channel and group information.', '获取渠道和分组信息'],
  ['Fetching provider and token information.', '获取供应商和令牌信息'],
  ['Unable to fetch management data.', '无法获取管理数据'],
  ['No providers with a management API are configured.', '没有配置管理 API 的厂商'],
  ['Invalid document format.', '文档格式错误'],
  ['All providers already exist, so nothing new was imported.', '所有厂商已存在，未导入新数据'],
  ['Unable to parse the document.', '无法解析文档'],
  ['Retrying with locally stored provider data.', '尝试重新加载本地存储的厂商数据'],
  ['Email and password cannot be empty.', '邮箱和密码不能为空。'],
  ['After repeated failures, complete Turnstile verification before trying again.', '连续失败后需要先通过 Turnstile 验证。'],
  ['Welcome back.', '欢迎回来。'],
  ['Enter your email and password.', '请输入邮箱和密码。'],
  ['You can continue signing in after verification succeeds.', '验证通过后才能继续登录。'],
  ['The current environment cannot copy the English prompt.', '当前环境无法复制英文提示词。'],
  ['The current environment cannot copy the Chinese prompt.', '当前环境无法复制中文提示词。'],
  ['Only a preview is available right now. The original image could not be found for download.', '当前仅有预览图，未找到可下载的原图。'],
  ['The original image has been copied to the clipboard.', '原图已复制到剪贴板'],
  ['The current environment cannot copy the original image directly. Please download it instead.', '当前环境无法直接复制原图，请改用下载。'],
  ['The prompt has been copied to the clipboard.', '提示词已复制到剪贴板'],
  ['The current environment cannot copy the prompt.', '当前环境无法复制提示词。'],
  ['Check your network or API Key.', '请检查网络或 API Key'],
  ['Clipboard write is not supported in the current environment.', '当前环境不支持剪贴板写入'],
  ['Enter the new content directly instead.', '请直接输入新的内容'],
  ['You can continue the conversation in a new branch.', '可以在新分支继续对话'],
  ['Keep at least one conversation.', '至少保留一个会话'],
  ['The conversation has been exported as JSON.', '会话已导出为 JSON'],
  ['JSON parsing failed.', 'JSON 解析失败'],
  ['Please cancel some excluded items and try again.', '请取消部分排除项后重试'],
  ['The prompt has been appended to the input box. You can keep editing before sending.', '已追加到输入框，可继续编辑后发送'],
  ['No image data was retrieved successfully.', '没有成功获取到图片数据。'],
  ['Something went wrong while packaging images. Please try again later.', '打包图片时出现问题，请稍后重试。'],
  ['No broken cards or invalid groups were found in the current project.', '当前项目没有发现错误卡片或失效分组。'],
  ['The current state is temporarily unavailable. Please try again later.', '当前状态暂时无法读取，请稍后再试。'],
  ['Please switch to the latest version of Chrome or Edge.', '请改用最新版 Chrome 或 Edge。'],
  ['Please choose and authorize a local folder first.', '请先选择并授权本地文件夹。'],
  ['Saving local-folder mode failed. Please try again.', '本地文件夹模式保存失败，请重试。'],
  ['The app is now using local-folder storage.', '现在已经改为本地文件夹存储。'],
  ['The local folder connection failed. Please try again later.', '本地文件夹连接失败，请稍后再试。'],
  ['Saving browser-storage mode failed. Please try again.', '浏览器存储模式保存失败，请重试。'],
  ['The app is now using browser storage.', '现在已经改为浏览器存储。'],
  ['Switching browser storage failed. Please try again later.', '浏览器存储切换失败，请稍后再试。'],
  ['Choose a source project to merge into the current project first.', '先选择一个要合并到当前项目的来源项目。'],
  ['The source project list has changed. Please choose again.', '来源项目列表已变化，请重新选择。'],
  ['Open a project first.', '请先打开一个项目。'],
  ['The current filtered results will be exported as a text document.', '当前筛选结果会导出为文本文档。'],
  ['Today’s logs have been cleared.', '今日日志已经清空。'],
  ['The default Agent cannot be deleted.', '默认Agent不能删除'],
  ['There are no images to export right now.', '当前没有可导出的图片'],
  ['No images were exported successfully.', '没有成功导出任何图片'],
  ['You cancelled the export.', '您已取消导出操作'],
  ['The original image could not be found.', '找不到原图'],
  ['The original image has been downloaded locally.', '原图已下载到本地'],
  ['Original images will be saved to the local documents folder.', '原图将保存到本地文档夹'],
  ['Original images will be saved in the browser.', '原图将保存在浏览器中'],
  ['Folder selection failed', '文档夹选择失败'],
  ['Unable to access the selected folder.', '无法获取文档夹访问权限'],
  ['Reference image limit', '参考图数量限制'],
  ['Reference attachments added', '已添加参考附件'],
  ['Reference images adjusted', '参考图已调整'],
  ['PPT outline applied', 'PPT页纲已应用'],
  ['Image generation failed', '图片生成失败'],
  ['AI generation failed', 'AI 生成失败'],
  ['No editable previous prompt found', '未找到可编辑的上一条提问'],
  ['Branch session created', '已创建分支会话'],
  ['No sessions available to import', '没有可导入会话'],
  ['Admin-configured credit models require a signed-in account before they can spend credits to chat.', '管理员配置的积分模型需要登录账号后使用积分才能进行对话。'],
  ['An error occurred while merging storage.', '合并存储时发生错误'],
];

const EXACT_TRANSLATIONS_TO_ZH = new Map<string, string>(
  EXACT_TRANSLATION_PAIRS.map(([en, zh]) => [en, zh])
);

const EXACT_TRANSLATIONS_TO_EN = new Map<string, string>(
  EXACT_TRANSLATION_PAIRS.map(([en, zh]) => [zh, en])
);

const REGEX_TRANSLATIONS_TO_ZH: Array<{ pattern: RegExp; replace: (...args: string[]) => string }> = [
  {
    pattern: /^Saved (\d+) editable PPT page(?:s)?\.$/,
    replace: (count) => `已保存 ${count} 页可编辑 PPT 页面。`,
  },
  {
    pattern: /^HTTP (\d+)$/,
    replace: (statusCode) => `请求失败（HTTP ${statusCode}）。`,
  },
];

const REGEX_TRANSLATIONS_TO_EN: Array<{ pattern: RegExp; replace: (...args: string[]) => string }> = [
  {
    pattern: /^已导出 (\d+) 页整屏长图$/,
    replace: (count) => `Exported ${count} full-length slide images.`,
  },
  {
    pattern: /^第 (\d+) 页已同步到主卡设置$/,
    replace: (count) => `Page ${count} has been synced to the main card settings`,
  },
  {
    pattern: /^已导出图 (\d+)$/,
    replace: (count) => `Exported image ${count}`,
  },
  {
    pattern: /^已更新图(\d+)$/,
    replace: (count) => `Updated image ${count}`,
  },
  {
    pattern: /^已导出 (\d+) 页的 \.pptx 文件$/,
    replace: (count) => `Exported a .pptx file with ${count} pages`,
  },
  {
    pattern: /^已导出 (\d+) 页的可编辑图层 PPTX$/,
    replace: (count) => `Exported an editable-layer PPTX with ${count} pages`,
  },
  {
    pattern: /^已导出 (\d+) 页，以及 editable 图层包、预览页和素材目录$/,
    replace: (count) => `Exported ${count} pages plus the editable layer package, previews, and assets`,
  },
  {
    pattern: /^系统已自动重新开始 (\d+) 个中断的任务$/,
    replace: (count) => `The system automatically restarted ${count} interrupted tasks`,
  },
  {
    pattern: /^已创建新项目并迁移 (\d+) 个项目$/,
    replace: (count) => `Created a new project and migrated ${count} items`,
  },
  {
    pattern: /^已获取 (\d+) 个模型。?$/,
    replace: (count) => `Fetched ${count} models.`,
  },
  {
    pattern: /^成功刷新 (\d+) 个厂商$/,
    replace: (count) => `Refreshed ${count} providers successfully`,
  },
  {
    pattern: /^成功同步 (\d+) 张图片，跳过 (\d+) 张重复图片$/,
    replace: (mergedCount, skippedCount) => `Synced ${mergedCount} images and skipped ${skippedCount} duplicates successfully`,
  },
  {
    pattern: /^已到账 (\d+) 积分$/,
    replace: (count) => `${count} credits have been added to your balance`,
  },
  {
    pattern: /^最多支持 (\d+) 张参考图$/,
    replace: (count) => `You can upload up to ${count} reference images`,
  },
  {
    pattern: /^最多只能上传 (\d+) 张参考图$/,
    replace: (count) => `You can upload up to ${count} reference images`,
  },
  {
    pattern: /^最多只能上传 (\d+) 张参考图，已自动忽略 (\d+) 张$/,
    replace: (limit, ignored) => `You can upload up to ${limit} reference images. ${ignored} were ignored automatically.`,
  },
  {
    pattern: /^已成功导出 (\d+) 张原图，失败 (\d+) 张$/,
    replace: (successCount, failedCount) => `Successfully exported ${successCount} original images; ${failedCount} failed.`,
  },
  {
    pattern: /^正在导出 (\d+) 张原图\.\.\.$/,
    replace: (count) => `Exporting ${count} original images...`,
  },
  {
    pattern: /^覆盖导入 (\d+) 个会话$/,
    replace: (count) => `Replaced with ${count} imported sessions`,
  },
  {
    pattern: /^追加导入 (\d+) 个会话$/,
    replace: (count) => `Appended ${count} imported sessions`,
  },
  {
    pattern: /^智能合并后保留 (\d+) 个会话$/,
    replace: (count) => `Kept ${count} sessions after smart merge`,
  },
  {
    pattern: /^已导出 (\d+) 页与 pages\/outline\/meta 目录$/,
    replace: (count) => `Exported ${count} pages with the pages/outline/meta directories`,
  },
  {
    pattern: /^耗时 (\d+)ms$/,
    replace: (duration) => `Completed in ${duration}ms`,
  },
  {
    pattern: /^成功 (\d+) 个，失败 (\d+) 个$/,
    replace: (successCount, failCount) => `Succeeded: ${successCount}, failed: ${failCount}`,
  },
  {
    pattern: /^已更新 (\d+) 个渠道$/,
    replace: (count) => `Updated ${count} channels`,
  },
  {
    pattern: /^已导出 (\d+) 个厂商配置$/,
    replace: (count) => `Exported ${count} provider configurations`,
  },
  {
    pattern: /^已导入 (\d+) 个厂商配置$/,
    replace: (count) => `Imported ${count} provider configurations`,
  },
  {
    pattern: /^已添加 (.+)$/,
    replace: (name) => `Added ${name}`,
  },
  {
    pattern: /^供应商 "(.+)" 已被删除$/,
    replace: (name) => `Provider "${name}" has been deleted`,
  },
  {
    pattern: /^已从 "(.+)" 获取到最新模型信息$/,
    replace: (name) => `Fetched the latest model information from "${name}"`,
  },
  {
    pattern: /^无法从 "(.+)" 获取模型信息$/,
    replace: (name) => `Unable to fetch model information from "${name}"`,
  },
  {
    pattern: /^从文档 (.+)$/,
    replace: (fileName) => `Loaded from document ${fileName}`,
  },
  {
    pattern: /^已保存到下载文档夹: (.+)$/,
    replace: (fileName) => `Saved to the Downloads folder: ${fileName}`,
  },
  {
    pattern: /^已设置 (\d+) 页，生成时将按图1~图(\d+)输出$/,
    replace: (count) => `Set ${count} pages. Generation will output from page 1 to page ${count}`,
  },
  {
    pattern: /^检测到 (\d+) 张重复图片，未重复添加。$/,
    replace: (count) => `Detected ${count} duplicate images, so they were not added again`,
  },
  {
    pattern: /^正在将 (\d+) 张图片同步到本地文档夹\.\.\.$/,
    replace: (count) => `Syncing ${count} images to the local documents folder...`,
  },
  {
    pattern: /^使用当前配置需要 (\d+) 积分，当前余额: (.+)，请充值。$/,
    replace: (credits, balance) => `This configuration needs ${credits} credits. Current balance: ${balance}. Please top up.`,
  },
  {
    pattern: /^粘贴导入 (\d+) 个文档$/,
    replace: (count) => `Imported ${count} documents from paste`,
  },
  {
    pattern: /^拖拽导入 (\d+) 个文档$/,
    replace: (count) => `Imported ${count} documents from drag and drop`,
  },
  {
    pattern: /^使用当前管理员模型进行对话需要 (\d+) 积分，当前余额: (.+)，请充值。$/,
    replace: (credits, balance) => `Using the current admin model to chat requires ${credits} credits. Current balance: ${balance}. Please top up.`,
  },
];

const TERM_TRANSLATION_PAIRS: Array<[RegExp, string, RegExp, string]> = [
  [/\bSystem Access Token\b/g, '系统访问令牌', /系统访问令牌/g, 'System Access Token'],
  [/\bAPI Key\b/g, '接口密钥', /接口密钥/g, 'API Key'],
  [/\bBase URL\b/g, '接口地址', /接口地址/g, 'Base URL'],
  [/\bManaged Exchange Rate\b/g, '后台汇率联动', /后台汇率联动/g, 'Managed Exchange Rate'],
  [/\bCard \/ PayPal\b/g, '银行卡 \/ PayPal', /银行卡 \/ PayPal/g, 'Card / PayPal'],
  [/\bPayment Method\b/g, '支付方式', /支付方式/g, 'Payment Method'],
  [/\bQuick Text\b/g, '快速改字', /快速改字/g, 'Quick Text'],
  [/\bEdit Deck\b/g, '编辑页面包', /编辑页面包/g, 'Edit Deck'],
];

export const localizeUserFacingText = (value?: string | null): string | undefined => {
  if (value == null) return undefined;
  const targetLanguage = getDocumentLanguage();

  if (targetLanguage === 'zh-CN') {
    if (EXACT_TRANSLATIONS_TO_ZH.has(value)) {
      return EXACT_TRANSLATIONS_TO_ZH.get(value);
    }

    for (const entry of REGEX_TRANSLATIONS_TO_ZH) {
      const matched = value.match(entry.pattern);
      if (matched) {
        return entry.replace(...matched.slice(1));
      }
    }

    let nextValue = value;
    for (const [fromEnglishPattern, chineseReplacement] of TERM_TRANSLATION_PAIRS) {
      nextValue = nextValue.replace(fromEnglishPattern, chineseReplacement);
    }

    return nextValue;
  }

  if (EXACT_TRANSLATIONS_TO_EN.has(value)) {
    return EXACT_TRANSLATIONS_TO_EN.get(value);
  }

  for (const entry of REGEX_TRANSLATIONS_TO_EN) {
    const matched = value.match(entry.pattern);
    if (matched) {
      return entry.replace(...matched.slice(1));
    }
  }

  let nextValue = value;
  for (const [, , fromChinesePattern, englishReplacement] of TERM_TRANSLATION_PAIRS) {
    nextValue = nextValue.replace(fromChinesePattern, englishReplacement);
  }

  return nextValue;
};
