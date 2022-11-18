import express from "express";

import routers from "./routers";
import log from "./log";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/heartbeat", (req, res) => res.send("OK"));

app.use("/", routers);

app.listen(3000, () => log.debug("listening on port 3000"));
