import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  InvalidClientError,
  InvalidTokenError,
  ServerError,
} from "oauth2-server";

const ddbClient = new DynamoDBClient({ region: "ap-southeast-2" });
const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
};
const unmarshallOptions = {
  wrapNumbers: false,
};
const translateConfig = { marshallOptions, unmarshallOptions };
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

let cachedClients: Record<string, StoredOAuthClient> = {};

setInterval(() => {
  cachedClients = {};
}, 1000 * 60 * 5);

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
  validateScope: (user, client, scope) => {
    // check if scope is valid for client/user
    return scope;
  },
  getAccessToken: async (token) => {
    // return token response from access token
    const Item = await getTokenFromAccessToken(token);

    if (!Item || Item.accessTokenExpiresAt < Date.now())
      throw new InvalidTokenError("Token Invalid");

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
    return true;
  },
};

export default model;
