export interface LobeIconCdnConfig {
  cdn?: 'github' | 'aliyun' | 'unpkg' | 'jsdelivr';
  format?: 'svg' | 'png' | 'webp' | 'avatar';
  isDarkMode?: boolean;
  type?: 'mono' | 'color' | 'text' | 'text-cn' | 'text-color' | 'brand' | 'brand-color';
}

function getGithubIconCdn(type: 'svg' | 'png' | 'webp' | 'avatar') {
  return `https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-${type}`;
}

function getAliyunIconCdn(type: 'svg' | 'png' | 'webp' | 'avatar') {
  return `https://registry.npmmirror.com/@lobehub/icons-static-${type}/latest/files`;
}

function getUnpkgIconCdn(type: 'svg' | 'png' | 'webp' | 'avatar') {
  return `https://unpkg.com/@lobehub/icons-static-${type}@latest`;
}

function getJsDelivrIconCdn(type: 'svg' | 'png' | 'webp' | 'avatar') {
  return `https://cdn.jsdelivr.net/npm/@lobehub/icons-static-${type}@latest`;
}

export function getLobeIconCdnUrl(id: string, config: LobeIconCdnConfig = {}) {
  const {
    format = 'png',
    isDarkMode = false,
    type = 'color',
    cdn = 'github',
  } = config;

  let baseUrl = '';
  switch (cdn) {
    case 'github':
      baseUrl = getGithubIconCdn(format);
      break;
    case 'unpkg':
      baseUrl = getUnpkgIconCdn(format);
      break;
    case 'aliyun':
      baseUrl = getAliyunIconCdn(format);
      break;
    case 'jsdelivr':
      baseUrl = getJsDelivrIconCdn(format);
      break;
  }

  const normalizedId = id.toLowerCase();
  if (format === 'avatar') {
    return `${baseUrl}/avatars/${normalizedId}.webp`;
  }

  const addon = type === 'mono' ? '' : `-${type}`;
  switch (format) {
    case 'svg':
      return `${baseUrl}/icons/${normalizedId + addon}.svg`;
    case 'webp':
      return `${baseUrl}/${isDarkMode ? 'dark' : 'light'}/${normalizedId + addon}.webp`;
    default:
      return `${baseUrl}/${isDarkMode ? 'dark' : 'light'}/${normalizedId + addon}.png`;
  }
}
