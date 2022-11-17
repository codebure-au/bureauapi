import express from "express";

import routers from "./routers";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", routers);

app.listen(3000, () => console.log("listening on port 3000"));
