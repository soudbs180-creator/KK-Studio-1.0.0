import * as fs from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export interface LocalTokenOptions {
  tokenPath?: string;
  randomBytes?: (size: number) => Buffer;
}

function resolveDefaultTokenPath(): string {
  return path.join(os.homedir(), '.kk-studio', 'local-runner', 'token');
}

/** 本地握手凭据必须持久化到用户目录，避免重启时退回共享默认值。 */
export class LocalToken {
  private readonly currentToken: string;
  private readonly tokenPath: string;
  private readonly randomBytes: (size: number) => Buffer;

  constructor(options: LocalTokenOptions = {}) {
    this.tokenPath = options.tokenPath ?? resolveDefaultTokenPath();
    this.randomBytes = options.randomBytes ?? crypto.randomBytes;
    this.currentToken = this.loadOrCreateToken();
  }

  private loadOrCreateToken(): string {
    try {
      fs.mkdirSync(path.dirname(this.tokenPath), { recursive: true, mode: 0o700 });
      const storedToken = this.readStoredToken();
      if (storedToken) {
        fs.chmodSync(this.tokenPath, 0o600);
        return storedToken;
      }

      const generatedToken = this.randomBytes(TOKEN_BYTES).toString('hex');
      fs.writeFileSync(this.tokenPath, generatedToken, { encoding: 'utf8', mode: 0o600 });
      fs.chmodSync(this.tokenPath, 0o600);
      return generatedToken;
    } catch (cause) {
      throw new Error(
        'Local Runner token initialization failed. Check that the local state directory is writable.',
        { cause },
      );
    }
  }

  private readStoredToken(): string | null {
    if (!fs.existsSync(this.tokenPath)) {
      return null;
    }

    const storedToken = fs.readFileSync(this.tokenPath, 'utf8').trim();
    return TOKEN_PATTERN.test(storedToken) ? storedToken : null;
  }

  /** 使用常量时间比较验证 Bearer token，任何空值或长度异常均拒绝。 */
  public validate(token: string): boolean {
    if (!token) {
      return false;
    }

    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const expectedToken = Buffer.from(this.currentToken, 'utf8');
    const receivedToken = Buffer.from(cleanToken, 'utf8');

    return receivedToken.length === expectedToken.length
      && crypto.timingSafeEqual(receivedToken, expectedToken);
  }
}

export const localToken = new LocalToken();
