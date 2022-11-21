import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  InvalidClientError,
  InvalidTokenError,
  ServerError,
} from "oauth2-server";

import ddbDocClient from "../dynamo";
import log from "../log";

let cachedClients: Record<string, StoredOAuthClient> = {};
let cachedValidTokens: Record<string, StoredOAuthToken> = {};
let cachedInvalidTokens: string[] = [];

setInterval(() => {
  cachedClients = {};
}, 1000 * 60 * 60);

setInterval(() => {
  cachedValidTokens = {};
  cachedInvalidTokens = [];
}, 1000 * 60 * 2.5);

const getClientFromId = async (clientId: string) => {
  if (cachedClients[clientId]) return cachedClients[clientId];

  const params = {
    TableName: "bure_oauth_clients",
    Key: {
      id: clientId,
    },
  };

  const { Item } = await ddbDocClient.send(new GetCommand(params));
  return Item as StoredOAuthClient;
};

const getTokenFromAccessToken = async (accessToken: string) => {
  if (cachedValidTokens[accessToken]) return cachedValidTokens[accessToken];
  if (cachedInvalidTokens.includes(accessToken))
    throw new InvalidTokenError("Token Invalid.");

  const params = {
    TableName: "bure_oauth_tokens",
    Key: {
      accessToken,
    },
  };

  const { Item } = await ddbDocClient.send(new GetCommand(params));
  return Item as StoredOAuthToken;
};

const getUser = () => ({});

const model: OAuthModel = {
  getClient: async (clientId, clientSecret) => {
    // get client from client id and secret
    const Item = await getClientFromId(clientId);

    if (!Item || Item.clientSecret !== clientSecret)
      throw new InvalidClientError("Bad Request");

    const { id, grants } = Item;
    const oAuthClient: OAuthClient = {
      id,
      grants: grants.split(" "),
    };

    return oAuthClient;
  },
  getUserFromClient: async (client) => {
    // retrieve the user associated with the specified client
    return getUser();
  },
  saveToken: async (token, client, user) => {
    // save token and associate it with a client & user
    try {
      const { accessToken, accessTokenExpiresAt, scope } = token;

      const params = {
        TableName: "bure_oauth_tokens",
        Item: {
          accessToken,
          accessTokenExpiresAt: accessTokenExpiresAt
            ? accessTokenExpiresAt.getTime()
            : undefined,
          scope,
          clientId: client.id,
          clientGrants: client.grants.join(" "),
          ttl: Math.floor(
            (accessTokenExpiresAt
              ? accessTokenExpiresAt.getTime()
              : Date.now() + 1000 * 60 * 60) / 1000
          ),
        },
      };

      await ddbDocClient.send(new PutCommand(params));

      const tokenResponse: OAuthTokenResponse = {
        ...token,
        client,
        user,
      };

      return tokenResponse;
    } catch (e) {
      throw new ServerError("Error saving token");
    }
  },
  validateScope: async (user, client, scope) => {
    // check if scope is valid for client/user
    log.debug("validating scope", user, client, scope);
    const storedClient = await getClientFromId(client.id);

    const validScopes = storedClient.scope.split(" ");

    if (validScopes.includes(scope)) return scope;
    else return false;
  },
  getAccessToken: async (token) => {
    // return token response from access token
    const Item = await getTokenFromAccessToken(token);

    if (!Item || Item.accessTokenExpiresAt < Date.now()) {
      cachedInvalidTokens = [...cachedInvalidTokens, token];
      throw new InvalidTokenError("Token Invalid");
    } else if (!cachedValidTokens[token]) {
      cachedValidTokens[token] = Item;
    }

    const { accessToken, accessTokenExpiresAt, scope, clientId, clientGrants } =
      Item;

    const user = getUser();

    const oAuthToken: OAuthTokenResponse = {
      accessToken,
      accessTokenExpiresAt: new Date(accessTokenExpiresAt),
      scope,
      client: {
        id: clientId,
        grants: clientGrants.split(" "),
      },
      user,
    };

    return oAuthToken;
  },
  verifyScope: async (accessToken, scope) => {
    // verify whether token can access requested scope
    const client = await getClientFromId(accessToken.client.id);
    const validScopes = client.scope.split(" ");

    log.debug("verifying scope", validScopes, scope, accessToken);

    // can client use requested scope?
    if (validScopes.includes(scope)) {
      // is client authorised to use this scope?
      const authorisedScopes = accessToken.scope
        ? Array.isArray(accessToken.scope)
          ? accessToken.scope
          : accessToken.scope.split(" ")
        : undefined;

      if (authorisedScopes?.includes(scope)) return true;
    }

    return false;
  },
};

export default model;
