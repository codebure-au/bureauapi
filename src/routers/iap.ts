import { Router } from "express";
import axios, { AxiosError } from "axios";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { auth, androidpublisher_v3 } from "@googleapis/androidpublisher";

import ddbDocClient from "../dynamo";
import { getGoogleAuth } from "../secrets-manager";
import authenticator from "../oauth/authenticate";
import log from "../log";
import ErrorWithStatus from "../error/ErrorWithStatus";

const iosSecret = process.env["IOS_SECRET"];
let publisher: androidpublisher_v3.Androidpublisher;

getGoogleAuth().then((authFile) => {
  const googleAuth = new auth.GoogleAuth({
    credentials: authFile,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  publisher = new androidpublisher_v3.Androidpublisher({ auth: googleAuth });

  log.debug("established android publisher");
});

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
      validationResponse: any;
      transactionLogged: boolean;
    }
  | string,
  {
    purchaseToken: string;
    packageName: string;
    productId: string;
    development?: boolean;
  }
>("/android", async (req, res) => {
  try {
    const { purchaseToken, packageName, productId } = req.body;

    if (!publisher)
      throw new ErrorWithStatus("no google verification available", 500);
    if (!purchaseToken)
      throw new ErrorWithStatus("no purchaseToken in request body", 400);
    if (!packageName)
      throw new ErrorWithStatus("no packageName in request body", 400);
    if (!productId)
      throw new ErrorWithStatus("no productId in request body", 400);

    const { data } = await publisher.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken,
    });

    const transactionLogged =
      data.purchaseType === 0
        ? false
        : await logGoogleTransaction(data as GoogleProductPurchase);

    res.json({ transactionLogged, validationResponse: data });
  } catch (e: any) {
    const error: AxiosError = e;
    log.error("failed to validate receipt", error);
    res.status(error.status || 500).send(error.message);
  }
});

export default router;
