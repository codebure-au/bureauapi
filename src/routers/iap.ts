import { Router } from "express";
import axios, { AxiosError } from "axios";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

import ddbDocClient from "../dynamo";
import authenticator from "../oauth/authenticate";
import log from "../log";
import ErrorWithStatus from "../error/ErrorWithStatus";

const iosSecret = process.env["IOS_SECRET"];

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

const router = Router();

router.use(authenticator("iap"));

router.post<
  "/ios",
  {},
  { receipt: any; transactionLogged: boolean } | { error: string },
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
    ): Promise<{ receipt: any; transactionLogged: boolean }> => {
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

      return { receipt: data.receipt, transactionLogged };
    };

    const response = await validateReceipt(receipt);

    res.json(response);
  } catch (e: any) {
    const error: AxiosError = e;
    log.error("failed to validate receipt", error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
