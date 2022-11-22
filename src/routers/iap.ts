import { Router } from "express";
import axios, { AxiosError } from "axios";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import GoogleReceiptVerify from "google-play-billing-validator";

import ddbDocClient from "../dynamo";
import { getPrivateKey } from "../secrets-manager";
import authenticator from "../oauth/authenticate";
import log from "../log";
import ErrorWithStatus from "../error/ErrorWithStatus";

const iosSecret = process.env["IOS_SECRET"];
import { googleVerifierEmail } from "../config.json";

const logAppleTransaction = async (receipt: AppleLatestReceipt) => {
  try {
    if (!receipt) throw new Error("no receipt provided");

    const params = {
      TableName: "bure_apple_transactions",
      Item: receipt,
    };

    await ddbDocClient.send(new PutCommand(params));

    return true;
  } catch (e) {
    log.error("failed to log apple transaction", e);
    return false;
  }
};

const logGoogleTransaction = async (receipt: GoogleProductPurchase) => {
  try {
    if (!receipt) throw new Error("no receipt provided");

    const params = {
      TableName: "bure_google_transactions",
      Item: receipt,
    };

    await ddbDocClient.send(new PutCommand(params));

    return true;
  } catch (e) {
    log.error("failed to log google transaction", e);
    return false;
  }
};

const router = Router();

router.use(authenticator("iap"));

router.post<
  "/ios",
  {},
  | {
      validationResponse: AppleValidationResponse;
      transactionLogged: boolean;
    }
  | { error: string },
  { receipt: string }
>("/ios", async (req, res) => {
  try {
    const { receipt } = req.body;

    if (!iosSecret)
      throw new ErrorWithStatus("no ios secret in environment variables", 500);
    if (!receipt) throw new ErrorWithStatus("no receipt in request body", 400);

    const validateReceipt = async (
      receipt: string,
      development = false
    ): Promise<{
      validationResponse: AppleValidationResponse;
      transactionLogged: boolean;
    }> => {
      const validationUrl = development
        ? `https://sandbox.itunes.apple.com/verifyReceipt`
        : `https://buy.itunes.apple.com/verifyReceipt`;

      const body = {
        "receipt-data": receipt,
        password: iosSecret,
        "exclude-old-transactions": false,
      };

      const { data } = await axios.post<AppleValidationResponse>(
        validationUrl,
        body
      );

      if (data.status === 21007) {
        log.debug("this one should have gone to sandbox");
        return await validateReceipt(receipt, true);
      }

      const transactionLogged =
        data.environment === "Production"
          ? await logAppleTransaction(data.latest_receipt_info[0])
          : false;

      return {
        validationResponse: data,
        transactionLogged,
      };
    };

    const response = await validateReceipt(receipt);

    res.json(response);
  } catch (e: any) {
    const error: AxiosError = e;
    log.error("failed to validate receipt", error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post<
  "/android",
  {},
  | {
      validationResponse: GoogleValidationResponse;
      transactionLogged: boolean;
    }
  | { error: string },
  {
    purchaseToken: string;
    packageName: string;
    productId: string;
    development?: boolean;
  }
>("/android", async (req, res) => {
  try {
    const { purchaseToken, packageName, productId, development } = req.body;
    const privateKey = await getPrivateKey();

    if (!privateKey) throw new ErrorWithStatus("no private key available", 500);
    if (!purchaseToken)
      throw new ErrorWithStatus("no purchaseToken in request body", 400);
    if (!packageName)
      throw new ErrorWithStatus("no packageName in request body", 400);
    if (!productId)
      throw new ErrorWithStatus("no productId in request body", 400);

    const receiptVerify = new GoogleReceiptVerify({
      email: googleVerifierEmail,
      key: privateKey,
    });

    const response = await receiptVerify.verifyINAPP({
      packageName,
      productId,
      purchaseToken,
    });

    const transactionLogged = development
      ? false
      : await logGoogleTransaction(response.payload);

    res.json({ transactionLogged, validationResponse: response });
  } catch (e: any) {
    const error: AxiosError = e;
    log.error("failed to validate receipt", error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
