// 简体中文：敏感文件文件名扫描器 (Sensitive File Scanner)

const sensitiveNamePatterns = [
  '.env',
  '.env.local',
  '.env.production',
  'api-key',
  'apikey',
  'secret',
  'token',
  'credential',
  'credentials',
  'private_key',
  'id_rsa',
  '.pem',
  '.key'
];

/**
 * 扫描检测文件及相对路径是否包含敏感词汇
 */
export function detectSensitiveFile(file: File, relativePath?: string): { sensitive: boolean; reason?: string } {
  const name = `${relativePath || ''}/${file.name}`.toLowerCase();
  const matched = sensitiveNamePatterns.find(pattern => name.includes(pattern));

  if (matched) {
    return {
      sensitive: true,
      reason: `文件名或相对路径中命中敏感规则：${matched}`
    };
  }

  return { sensitive: false };
}
