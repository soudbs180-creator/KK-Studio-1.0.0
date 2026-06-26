import {
  callSecureSystemProxyChat,
  callSecureSystemProxyImage,
  callSecureSystemProxyVideo,
  callSecureSystemProxyAudio,
  buildSecureProxyUserRouteFromSlotId
} from '../../services/model/secureModelProxy';
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

export class CloudRelayClient {
  public async chat(payload: SecureProxyChatRequest & { routeId: string }): Promise<SecureProxyChatResponse> {
    return callSecureSystemProxyChat({
      ...payload,
      userRoute: buildSecureProxyUserRouteFromSlotId(payload.routeId),
    });
  }

  public async generateImage(payload: SecureProxyImageRequest & { routeId: string }): Promise<SecureProxyImageResponse> {
    return callSecureSystemProxyImage({
      ...payload,
      userRoute: buildSecureProxyUserRouteFromSlotId(payload.routeId),
    });
  }

  public async generateVideo(payload: SecureProxyVideoRequest & { routeId: string }): Promise<SecureProxyVideoResponse> {
    return callSecureSystemProxyVideo({
      ...payload,
      userRoute: buildSecureProxyUserRouteFromSlotId(payload.routeId),
    });
  }

  public async generateAudio(payload: SecureProxyAudioRequest & { routeId: string }): Promise<SecureProxyAudioResponse> {
    return callSecureSystemProxyAudio({
      ...payload,
      userRoute: buildSecureProxyUserRouteFromSlotId(payload.routeId),
    });
  }
}

export const cloudRelayClient = new CloudRelayClient();
