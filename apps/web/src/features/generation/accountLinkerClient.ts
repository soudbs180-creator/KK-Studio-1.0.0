import type {
  SecureProxyChatRequest,
  SecureProxyImageRequest,
  SecureProxyVideoRequest,
  SecureProxyAudioRequest,
  SecureProxyChatResponse,
  SecureProxyImageResponse,
  SecureProxyVideoResponse,
  SecureProxyAudioResponse
} from '../../services/model/secureModelProxy';

export class AccountLinkerClient {
  public async chat(_payload: SecureProxyChatRequest): Promise<SecureProxyChatResponse> {
    throw new Error('Account Bridge 模式暂不支持，请在设置中配置有效的 API Key 或使用平台积分模式。');
  }

  public async generateImage(_payload: SecureProxyImageRequest): Promise<SecureProxyImageResponse> {
    throw new Error('Account Bridge 模式暂不支持，请在设置中配置有效的 API Key 或使用平台积分模式。');
  }

  public async generateVideo(_payload: SecureProxyVideoRequest): Promise<SecureProxyVideoResponse> {
    throw new Error('Account Bridge 模式暂不支持，请在设置中配置有效的 API Key 或使用平台积分模式。');
  }

  public async generateAudio(_payload: SecureProxyAudioRequest): Promise<SecureProxyAudioResponse> {
    throw new Error('Account Bridge 模式暂不支持，请在设置中配置有效的 API Key 或使用平台积分模式。');
  }
}

export const accountLinkerClient = new AccountLinkerClient();
