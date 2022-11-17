import OAuth2Server from "oauth2-server";

import model from "./model";

const oauth = new OAuth2Server({ model });

export default oauth;
