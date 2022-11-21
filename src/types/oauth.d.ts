interface OAuthModel {
  getClient: (clientId: string, clientSecret: string) => Promise<OAuthClient>;
  getUserFromClient: (client: OAuthClient) => Promise<OAuthUser | false>;
  saveToken: (
    token: OAuthToken,
    client: OAuthClient,
    user: OAuthUser
  ) => Promise<OAuthTokenResponse | false>;
  validateScope: (
    user: OAuthUser,
    client: OAuthClient,
    scope: string
  ) => string | false;
  getAccessToken: (accessToken: string) => Promise<OAuthTokenResponse>;
  verifyScope: (
    accessToken: OAuthTokenResponse,
    scope: string
  ) => Promise<boolean>;
}

interface OAuthClient {
  id: string;
  redirect_uris?: string[];
  grants: string[];
  accessTokenLifetime?: number;
  refreshTokenLifetime?: number;
}

interface OAuthUser {}

interface OAuthToken {
  accessToken: string;
  accessTokenExpiresAt?: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  scope?: string | string[];
}

interface OAuthTokenResponse extends OAuthToken {
  client: OAuthClient;
  user: OAuthUser;
}

interface StoredOAuthClient {
  id: string;
  clientSecret: string;
  grants: string;
  scope: string;
}

interface StoredOAuthToken extends OAuthToken {
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt?: number;
  clientId: string;
  clientGrants: string;
}
