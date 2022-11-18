import { Router } from "express";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import authenticationMiddleware from "../oauth/authenticate";
import ddbDocClient from "../dynamo";
import log from "../log";
import UserError from "../error/UserError";
import ErrorWithStatus from "../error/ErrorWithStatus";

const router = Router();

router.get<{ appId: string }>("/:appId", async (req, res) => {
  try {
    const { appId } = req.params;

    if (!appId || !appId.length) throw new UserError("no appId provided");

    const params = {
      TableName: "bure_app_versions",
      Key: {
        appId,
      },
    };

    const { Item } = await ddbDocClient.send(new GetCommand(params));

    if (Item === undefined) throw new UserError("appId not found in database");

    log.debug("got version data", Item);

    const { ios, android } = Item as AppVersionData;

    res.json({ appId, ios, android });
  } catch (e: any) {
    const error: UserError = e;
    log.error("failed to get version data", error);
    res.status(error.statusCode || 500).send(error.message);
  }
});

router.post<
  "/:appId",
  { appId: string },
  any,
  { ios: string; android: string }
>("/:appId", authenticationMiddleware, async (req, res) => {
  try {
    const validateVersionFormat = (version: string) => {
      const validationRegEx =
        /^(?:[1-9]\d|[1-9])?\d\.(?:[1-9]\d|[1-9])?\d\.(?:[1-9]\d|[1-9])?\d$/;
      const valid = validationRegEx.test(version);

      return valid;
    };
    const validateAppIdFormat = (appId: string) => {
      const appIdFormat = /^au\.com\.bure\.apps\.[a-z]{4,16}$/;
      const valid = appIdFormat.test(appId);

      return valid;
    };

    const { ios, android } = req.body;
    const { appId } = req.params;

    if (!appId || !appId.length) throw new UserError("no appId provided");
    if (!validateAppIdFormat(appId))
      throw new UserError("appId failed format validation");

    if (!ios || !ios.length) throw new UserError("no ios provided");
    if (!validateVersionFormat(ios))
      throw new UserError("ios version failed format validation");

    if (!android || !android.length) throw new UserError("no android provided");
    if (!validateVersionFormat(android))
      throw new UserError("android version failed format validation");

    const params = {
      TableName: "bure_app_versions",
      Item: {
        appId,
        ios,
        android,
      },
    };

    await ddbDocClient.send(new PutCommand(params));

    res.json({ appId, ios, android });
  } catch (e: any) {
    const error: ErrorWithStatus = e;
    log.error("failed to update version data", error);
    res.status(error.statusCode || 500).send(error.message);
  }
});

export default router;
