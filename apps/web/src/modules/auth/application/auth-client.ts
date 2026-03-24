import type {
  ApiClientRequestOptions,
  KkApiClient,
} from "../../../../../../packages/contracts/src/client/kk-api-client.ts";
import type {
  LoginRequestDto,
  LoginResponseDto,
  ProfileDto,
  RegisterRequestDto,
  RegisterResponseDto,
  UpdateProfileRequestDto,
} from "../../../../../../packages/contracts/src/dto/auth.ts";
import type { ApiResponse } from "../../../../../../packages/contracts/src/http/envelope.ts";

export class AuthClient {
  private readonly apiClient: KkApiClient;

  constructor(apiClient: KkApiClient) {
    this.apiClient = apiClient;
  }

  register(
    input: RegisterRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<RegisterResponseDto>> {
    return this.apiClient.register(input, options);
  }

  login(
    input: LoginRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<LoginResponseDto>> {
    return this.apiClient.login(input, options);
  }

  getProfile(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProfileDto>> {
    return this.apiClient.getProfile(options);
  }

  updateProfile(
    input: UpdateProfileRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<ProfileDto>> {
    return this.apiClient.updateProfile(input, options);
  }
}
