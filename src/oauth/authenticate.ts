import { Handler } from "express";
import { Request, Response, OAuthError } from "oauth2-server";

import oauth from "./";

const authenticationMiddleware: Handler = async (req, res, next) => {
  try {
    const request = new Request(req);
    const response = new Response(res);

    await oauth.authenticate(request, response);

    next();
  } catch (e: any) {
    const error: OAuthError = e;
    console.log("authentication error", error);
    res.status(error.code).send("Unauthorized");
  }
};

export default authenticationMiddleware;
