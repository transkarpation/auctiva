import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import {
  listPublicAuctions,
  listAuctions,
  createAuction,
  deleteAuction,
  confirmBid,
} from "../controllers/auctions.controller.js";

export const auctionsRouter = Router();

// Declared before "/:id" routes (none are GET, but keep it explicit).
auctionsRouter.get("/public", asyncHandler(listPublicAuctions));
auctionsRouter.get("/", asyncHandler(listAuctions));
auctionsRouter.post("/", asyncHandler(createAuction));
auctionsRouter.post("/:id/bids/confirm", asyncHandler(confirmBid));
auctionsRouter.delete("/:id", asyncHandler(deleteAuction));
