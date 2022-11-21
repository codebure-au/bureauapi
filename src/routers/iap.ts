import { Router } from "express";
import axios, { AxiosError } from "axios";

import authenticator from "../oauth/authenticate";
import log from "../log";
import ErrorWithStatus from "../error/ErrorWithStatus";

const iosSecret = process.env["IOS_SECRET"];

const router = Router();

interface AppleValidationResponse {
  environment: "Sandbox" | "Production";
  "is-retryable": boolean;
  latest_receipt: string;
  latest_receipt_info: any[];
  pending_renewal_info: any[];
  receipt: any;
  status: number;
}

router.use(authenticator("iap"));

router.post<
  "/ios",
  {},
  AppleValidationResponse | { error: string },
  { receipt: string }
>("/ios", async (req, res) => {
  try {
    const { receipt } = req.body;

    if (!iosSecret)
      throw new ErrorWithStatus("no ios secret in environment variables", 500);

    const validateReceipt = async (
      receipt: string,
      development = false
    ): Promise<AppleValidationResponse> => {
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

      return data;
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
