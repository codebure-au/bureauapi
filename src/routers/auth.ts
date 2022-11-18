import { Router } from "express";
import { OAuthError, Request, Response } from "oauth2-server";

import oauth from "../oauth";
import log from "../log";

const router = Router();

router.post("/token", async (req, res) => {
  try {
    const request = new Request(req);
    const response = new Response(res);

    const token = await oauth.token(request, response);

    log.debug("got token", token);

    res.status(response.status || 200).send(response.body);
  } catch (e: any) {
    const error: OAuthError = e;
    log.error("got error generating token", error);

    res.status(error.code).send(error.message);
  }
});

export default router;
