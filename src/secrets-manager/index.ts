import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import log from "../log";

const secretsClient = new SecretsManagerClient({ region: "ap-southeast-2" });

let privateKey: string;

export const getPrivateKey = async () => {
  if (privateKey) return privateKey;

  const command = new GetSecretValueCommand({
    SecretId: "bure/google/verifier",
  });
  const { SecretString } = await secretsClient.send(command);

  if (SecretString) {
    const jsonObject = JSON.parse(SecretString);
    const newPrivateKey = jsonObject.google_verifier_private_key as string;

    privateKey = newPrivateKey;
    return newPrivateKey;
  }
};
