import { Router } from "express";
import authRouter from "./auth";
import authenticationMiddleware from "../oauth/authenticate";

const router = Router();

router.use("/auth", authRouter);

router.get("/", (req, res) => res.send("OK"));

router.get("/authed", authenticationMiddleware, (req, res) => res.send("OK"));

export default router;
