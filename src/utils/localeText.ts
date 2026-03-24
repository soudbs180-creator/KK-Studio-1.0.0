const DEFAULT_LANGUAGE = 'zh-CN';
const LANGUAGE_STORAGE_KEY = 'kk_language';

export type ResolvedLanguage = 'zh-CN' | 'en-US';

export const normalizeLanguage = (value?: string | null): ResolvedLanguage => {
  if (!value) return DEFAULT_LANGUAGE;
  return value.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
};

export const getDocumentLanguage = (): ResolvedLanguage => {
  if (typeof document !== 'undefined') {
    const { documentElement } = document;
    return normalizeLanguage(
      documentElement.dataset.language
      || documentElement.lang
      || null
    );
  }

  if (typeof window !== 'undefined') {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  }

  return DEFAULT_LANGUAGE;
};

export const isChineseDocumentLanguage = () => getDocumentLanguage() === DEFAULT_LANGUAGE;

export const pickByDocumentLanguage = <T,>(zh: T, en: T): T =>
  isChineseDocumentLanguage() ? zh : en;

const EXACT_TRANSLATIONS: Record<string, string> = {
  'Application Error': '应用错误',
  'Something went wrong. Please refresh the page.': '页面发生异常，请刷新后重试。',
  'Reload Page': '刷新页面',
  'Deck updated': '页面包已更新',
  'Timed out while waiting for Turnstile': '等待 Turnstile 组件加载超时。',
  'Failed to load Turnstile script': 'Turnstile 脚本加载失败。',
  'WeChat login widget can only run in the browser.': '微信登录组件只能在浏览器环境中运行。',
  'WeChat login widget is unavailable after the script finished loading.': '微信登录组件脚本加载完成后仍不可用。',
  'Unable to load the official WeChat login widget.': '无法加载微信官方登录组件。',
  'WeChat login widget mount point is unavailable.': '微信登录组件挂载节点不可用。',
  INVALID_LIGHTBOX_SOURCE: '图片预览源无效。',
  ORIGINAL_BLOB_UNAVAILABLE: '原始图片数据不可用。',
  INVALID_IMAGE_DATA_FORMAT: '图片数据格式无效。',
  'Fetch failed': '获取资源失败。',
  'Not an image': '获取到的内容不是图片。',
  'Unsupported storage format': '不支持的存储格式。',
  'Cloud fetch failed': '云端资源获取失败。',
  'No image data found': '未找到图片数据。',
  'Fallback fetch failed': '回退资源获取失败。',
  'Planner returned invalid JSON': '规划器返回了无效的 JSON 数据。',
  'Could not find root element to mount to': '未找到应用挂载根节点。',
  'useLocale must be used within a LocaleProvider': 'useLocale 必须在 LocaleProvider 内使用。',
  'useOnboarding must be used within OnboardingProvider': 'useOnboarding 必须在 OnboardingProvider 内使用。',
};

const REGEX_TRANSLATIONS: Array<{ pattern: RegExp; replace: (...args: string[]) => string }> = [
  {
    pattern: /^Saved (\d+) editable PPT page(?:s)?\.$/,
    replace: (count) => `已保存 ${count} 页可编辑 PPT 页面。`,
  },
  {
    pattern: /^HTTP (\d+)$/,
    replace: (statusCode) => `请求失败（HTTP ${statusCode}）。`,
  },
];

const TERM_TRANSLATIONS: Array<[RegExp, string]> = [
  [/\bSystem Access Token\b/g, '系统访问令牌'],
  [/\bAPI Key\b/g, '接口密钥'],
  [/\bBase URL\b/g, '接口地址'],
  [/\bManaged Exchange Rate\b/g, '后台汇率联动'],
  [/\bCard \/ PayPal\b/g, '银行卡 / PayPal'],
  [/\bPayment Method\b/g, '支付方式'],
  [/\bQuick Text\b/g, '快速改字'],
  [/\bEdit Deck\b/g, '编辑页面包'],
];

export const localizeUserFacingText = (value?: string | null): string | undefined => {
  if (value == null) return undefined;
  if (!isChineseDocumentLanguage()) return value;

  if (EXACT_TRANSLATIONS[value]) {
    return EXACT_TRANSLATIONS[value];
  }

  for (const entry of REGEX_TRANSLATIONS) {
    const matched = value.match(entry.pattern);
    if (matched) {
      return entry.replace(...matched.slice(1));
    }
  }

  let nextValue = value;
  for (const [pattern, replacement] of TERM_TRANSLATIONS) {
    nextValue = nextValue.replace(pattern, replacement);
  }

  return nextValue;
};
