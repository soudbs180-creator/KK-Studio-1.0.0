import {
  callSecureSystemProxyChat,
  callSecureSystemProxyImage,
  callSecureSystemProxyVideo,
  callSecureSystemProxyAudio
} from '../../services/model/secureModelProxy.ts';
import type {
  SecureProxyChatRequest,
  SecureProxyImageRequest,
  SecureProxyVideoRequest,
  SecureProxyAudioRequest,
  SecureProxyChatResponse,
  SecureProxyImageResponse,
  SecureProxyVideoResponse,
  SecureProxyAudioResponse
} from '../../services/model/secureModelProxy.ts';

export class PlatformCreditClient {
  public async chat(payload: SecureProxyChatRequest): Promise<SecureProxyChatResponse> {
    // Platform proxy route uses system slot
    return callSecureSystemProxyChat(payload);
  }

  public async generateImage(payload: SecureProxyImageRequest): Promise<SecureProxyImageResponse> {
    return callSecureSystemProxyImage(payload);
  }

  public async generateVideo(payload: SecureProxyVideoRequest): Promise<SecureProxyVideoResponse> {
    return callSecureSystemProxyVideo(payload);
  }

  public async generateAudio(payload: SecureProxyAudioRequest): Promise<SecureProxyAudioResponse> {
    return callSecureSystemProxyAudio(payload);
  }
}

export const platformCreditClient = new PlatformCreditClient();
