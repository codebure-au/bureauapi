import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import google from "googleapis";

const secretsClient = new SecretsManagerClient({ region: "ap-southeast-2" });

let cachedGoogleAuth: google.Auth.CredentialBody;

export const getGoogleAuth = async () => {
  if (cachedGoogleAuth) return cachedGoogleAuth;

  const command = new GetSecretValueCommand({
    SecretId: "bure/google/verifier",
  });
  const { SecretString } = await secretsClient.send(command);

  if (SecretString) {
    const jsonObject = JSON.parse(SecretString) as google.Auth.CredentialBody;

    cachedGoogleAuth = jsonObject;
    return jsonObject;
  }
};
