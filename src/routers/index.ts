import { Router } from "express";
import authRouter from "./auth";
import versionRouter from "./version";

const router = Router();

router.get("/", (req, res) => {
  res.send("This server has no content.");
});

router.use("/auth", authRouter);
router.use("/version", versionRouter);

export default router;
