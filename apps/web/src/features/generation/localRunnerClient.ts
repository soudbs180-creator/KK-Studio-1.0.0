import {
  callLocalUserRouteProxyChat,
  callLocalUserRouteProxyImage,
  callLocalUserRouteProxyVideo,
  callLocalUserRouteProxyAudio,
  SecureProxyChatRequest,
  SecureProxyImageRequest,
  SecureProxyVideoRequest,
  SecureProxyAudioRequest,
  SecureProxyChatResponse,
  SecureProxyImageResponse,
  SecureProxyVideoResponse,
  SecureProxyAudioResponse
} from '../../services/model/secureModelProxy';

export class LocalRunnerClient {
  public async chat(payload: SecureProxyChatRequest & { routeId: string }): Promise<SecureProxyChatResponse> {
    return callLocalUserRouteProxyChat(payload);
  }

  public async generateImage(payload: SecureProxyImageRequest & { routeId: string }): Promise<SecureProxyImageResponse> {
    return callLocalUserRouteProxyImage(payload);
  }

  public async generateVideo(payload: SecureProxyVideoRequest & { routeId: string }): Promise<SecureProxyVideoResponse> {
    return callLocalUserRouteProxyVideo(payload);
  }

  public async generateAudio(payload: SecureProxyAudioRequest & { routeId: string }): Promise<SecureProxyAudioResponse> {
    return callLocalUserRouteProxyAudio(payload);
  }
}

export const localRunnerClient = new LocalRunnerClient();
