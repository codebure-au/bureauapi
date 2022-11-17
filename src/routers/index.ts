import { Router } from "express";
import authRouter from "./auth";
import authenticationMiddleware from "../oauth/authenticate";

const router = Router();

router.use("/auth", authRouter);

export default router;
