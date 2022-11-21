import { Handler } from "express";
import { Request, Response, OAuthError } from "oauth2-server";

import oauth from "./";
import log from "../log";

const authenticator = (scope?: string) => {
  const middleware: Handler = async (req, res, next) => {
    try {
      const request = new Request(req);
      const response = new Response(res);

      await oauth.authenticate(request, response, { scope });

      next();
    } catch (e: any) {
      const error: OAuthError = e;
      log.error("authentication error", error);
      res.status(error.code).send("Unauthorized");
    }
  };

  return middleware;
};

export default authenticator;
