import { CapabilitySource } from './capabilitySource.ts';
import type { CapabilitySourceType, CapabilityProfile } from './capabilitySource.ts';
import { keyManager } from '../../services/auth/keyManager.ts';
import { getKkApiServerHealth } from '../../services/api/kkApiServerHealth.ts';
import { isMobileDevice } from '../../services/storage/storagePreference.ts';

export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private sources = new Map<CapabilitySourceType, CapabilitySource>();

  private constructor() {
    this.registerBuiltinSources();
  }

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  /**
   * Register a new capability source
   */
  public register(source: CapabilitySource): void {
    this.sources.set(source.getType(), source);
  }

  /**
   * Retrieve a capability source by type
   */
  public getSource(type: CapabilitySourceType): CapabilitySource | undefined {
    return this.sources.get(type);
  }

  /**
   * List all registered capability sources
   */
  public getAllSources(): CapabilitySource[] {
    return Array.from(this.sources.values());
  }

  /**
   * List all currently available capability sources
   */
  public async getAvailableSources(): Promise<CapabilitySource[]> {
    const available: CapabilitySource[] = [];
    for (const source of this.getAllSources()) {
      if (await source.isAvailable()) {
        available.push(source);
      }
    }
    return available;
  }

  /**
   * Find capability sources that support a given task type
   */
  public async findSourcesForTask(
    taskType: 'image' | 'text' | 'video' | 'batch' | 'audio' | 'browser-action'
  ): Promise<CapabilitySource[]> {
    const matched: CapabilitySource[] = [];
    const available = await this.getAvailableSources();
    for (const source of available) {
      const profile = await source.getProfile();
      if (profile.supportedTasks.includes(taskType)) {
        matched.push(source);
      }
    }
    return matched;
  }

  private registerBuiltinSources(): void {
    // 1. User Local API Source
    this.register(new class extends CapabilitySource {
      getType(): CapabilitySourceType { return 'api-user-local'; }
      getName(): string { return '用户本地 API 密钥'; }
      async isAvailable(): Promise<boolean> {
        const health = await getKkApiServerHealth();
        return health.reachable && keyManager.getSlots().some(k => k.type !== 'proxy' && k.status === 'valid');
      }
      async getProfile(): Promise<CapabilityProfile> {
        return {
          type: this.getType(),
          name: this.getName(),
          isAvailable: await this.isAvailable(),
          requiresAuth: true,
          requiresConfirmation: false,
          supportedTasks: ['image', 'text', 'video', 'batch', 'audio'],
          riskLevel: 'low'
        };
      }
    }());

    // 2. User Cloud API Source
    this.register(new class extends CapabilitySource {
      getType(): CapabilitySourceType { return 'api-user-cloud'; }
      getName(): string { return '用户云端 API 密钥'; }
      async isAvailable(): Promise<boolean> {
        return keyManager.getSlots().some(k => k.type === 'proxy' && k.status === 'valid');
      }
      async getProfile(): Promise<CapabilityProfile> {
        return {
          type: this.getType(),
          name: this.getName(),
          isAvailable: await this.isAvailable(),
          requiresAuth: true,
          requiresConfirmation: false,
          supportedTasks: ['image', 'text', 'video', 'batch', 'audio'],
          riskLevel: 'low'
        };
      }
    }());

    // 3. Platform API Source
    this.register(new class extends CapabilitySource {
      getType(): CapabilitySourceType { return 'api-platform'; }
      getName(): string { return '平台公共密钥 (速创通道)'; }
      async isAvailable(): Promise<boolean> {
        return true;
      }
      async getProfile(): Promise<CapabilityProfile> {
        return {
          type: this.getType(),
          name: this.getName(),
          isAvailable: await this.isAvailable(),
          requiresAuth: false,
          requiresConfirmation: false,
          supportedTasks: ['image', 'text', 'video', 'batch', 'audio'],
          riskLevel: 'low'
        };
      }
    }());

    // 4. Official OAuth Source
    this.register(new class extends CapabilitySource {
      getType(): CapabilitySourceType { return 'official-oauth-openai'; }
      getName(): string { return '官方 OAuth 登录态'; }
      async isAvailable(): Promise<boolean> {
        return keyManager.getSlots().some(k => k.provider === 'OpenAI' && k.type === 'proxy');
      }
      async getProfile(): Promise<CapabilityProfile> {
        return {
          type: this.getType(),
          name: this.getName(),
          isAvailable: await this.isAvailable(),
          requiresAuth: true,
          requiresConfirmation: false,
          supportedTasks: ['image', 'text', 'video'],
          riskLevel: 'low'
        };
      }
    }());

    // 5. User-Owned Web Provider (Personal Web Membership)
    this.register(new class extends CapabilitySource {
      getType(): CapabilitySourceType { return 'user-owned-web-provider'; }
      getName(): string { return '用户网页会员能力 (浏览器直连)'; }
      async isAvailable(): Promise<boolean> {
        if (isMobileDevice()) return false;
        const health = await getKkApiServerHealth();
        return health.reachable;
      }
      async getProfile(): Promise<CapabilityProfile> {
        return {
          type: this.getType(),
          name: this.getName(),
          isAvailable: await this.isAvailable(),
          requiresAuth: true,
          requiresConfirmation: true,
          supportedTasks: ['image', 'text', 'browser-action'],
          riskLevel: 'medium'
        };
      }
    }());

    // 6. Local OpenCLI / Chrome CDP Bridge
    this.register(new class extends CapabilitySource {
      getType(): CapabilitySourceType { return 'local-opencli'; }
      getName(): string { return '本地浏览器 OpenCLI 驱动'; }
      async isAvailable(): Promise<boolean> {
        if (isMobileDevice()) return false;
        const health = await getKkApiServerHealth();
        return health.reachable;
      }
      async getProfile(): Promise<CapabilityProfile> {
        return {
          type: this.getType(),
          name: this.getName(),
          isAvailable: await this.isAvailable(),
          requiresAuth: false,
          requiresConfirmation: true,
          supportedTasks: ['browser-action'],
          riskLevel: 'high'
        };
      }
    }());

    // 7. Local Model
    this.register(new class extends CapabilitySource {
      getType(): CapabilitySourceType { return 'local-model'; }
      getName(): string { return '本地端侧运行模型'; }
      async isAvailable(): Promise<boolean> {
        if (isMobileDevice()) return false;
        const health = await getKkApiServerHealth();
        return health.reachable;
      }
      async getProfile(): Promise<CapabilityProfile> {
        return {
          type: this.getType(),
          name: this.getName(),
          isAvailable: await this.isAvailable(),
          requiresAuth: false,
          requiresConfirmation: false,
          supportedTasks: ['text', 'image'],
          riskLevel: 'low'
        };
      }
    }());

    // 8. Cloud VPS
    this.register(new class extends CapabilitySource {
      getType(): CapabilitySourceType { return 'cloud-vps'; }
      getName(): string { return 'VPS 云端中继代理'; }
      async isAvailable(): Promise<boolean> {
        return true;
      }
      async getProfile(): Promise<CapabilityProfile> {
        return {
          type: this.getType(),
          name: this.getName(),
          isAvailable: await this.isAvailable(),
          requiresAuth: false,
          requiresConfirmation: false,
          supportedTasks: ['image', 'text', 'video'],
          riskLevel: 'low'
        };
      }
    }());
  }
}

export const capabilityRegistry = CapabilityRegistry.getInstance();
