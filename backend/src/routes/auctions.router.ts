import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import {
  listPublicAuctions,
  listAuctions,
  createAuction,
  updateAuction,
  publishAuction,
  deleteAuction,
  getAuction,
  getAuctionState,
  listAuctionBids,
  confirmBid,
} from "../controllers/auctions.controller.js";

export const auctionsRouter = Router();

// Specific paths before the generic "/:id" so they aren't captured by it.
auctionsRouter.get("/public", asyncHandler(listPublicAuctions));
auctionsRouter.get("/", asyncHandler(listAuctions));
auctionsRouter.get("/:id/state", asyncHandler(getAuctionState));
auctionsRouter.get("/:id/bids", asyncHandler(listAuctionBids));
auctionsRouter.get("/:id", asyncHandler(getAuction));
auctionsRouter.post("/", asyncHandler(createAuction));
auctionsRouter.post("/:id/publish", asyncHandler(publishAuction));
auctionsRouter.post("/:id/bids/confirm", asyncHandler(confirmBid));
auctionsRouter.patch("/:id", asyncHandler(updateAuction));
auctionsRouter.delete("/:id", asyncHandler(deleteAuction));
