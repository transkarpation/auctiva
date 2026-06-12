// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

contract SimpleAuction {
    // Parameters of the auction.
    address payable public beneficiary;
    uint256 public auctionEndTime;

    // Minimum amount for the very first bid (in wei).
    uint256 public startingPrice;

    // Current state of the auction.
    address public highestBidder;
    uint256 public highestBid;

    // Minimum amount by which a new bid must exceed the current highest bid.
    uint256 public minBidIncrement;

    // Allowed withdrawals of previous bids.
    mapping(address => uint256) public pendingReturns;

    // Set to true at the end, disallows any change.
    bool public ended;

    // Events that will be emitted on changes.
    event HighestBidIncreased(address bidder, uint256 amount);
    event AuctionEnded(address winner, uint256 amount);
    event MinBidIncrementChanged(uint256 oldIncrement, uint256 newIncrement);

    // Custom errors.
    error AuctionAlreadyEnded();
    error BidNotHighEnough(uint256 requiredBid);
    error AuctionNotYetEnded();
    error AuctionEndAlreadyCalled();
    error NotBeneficiary();

    /// Create a simple auction running for `biddingTime` seconds on behalf of
    /// `beneficiaryAddress`.
    ///
    /// `startingPrice_` is the minimum amount accepted for the first bid;
    /// `minimumIncrement` is the minimum amount by which every subsequent bid
    /// must exceed the current highest bid.
    constructor(
        uint256 startingPrice_,
        uint256 biddingTime,
        address payable beneficiaryAddress,
        uint256 minimumIncrement
    ) {
        startingPrice = startingPrice_;
        auctionEndTime = block.timestamp + biddingTime;
        beneficiary = beneficiaryAddress;
        minBidIncrement = minimumIncrement;
    }

    modifier onlyBeneficiary() {
        if (msg.sender != beneficiary) {
            revert NotBeneficiary();
        }
        _;
    }

    /// Returns the minimum bid required to become the current highest bidder:
    /// the starting price while there are no bids yet, otherwise the current
    /// highest bid plus the minimum increment.
    function getMinimumRequiredBid() public view returns (uint256) {
        if (highestBid == 0) {
            return startingPrice;
        }

        return highestBid + minBidIncrement;
    }

    /// Bid on the auction. The value sent with this transaction is added to any
    /// funds the caller already has locked in the contract, so a returning
    /// bidder only needs to send the additional amount to top up their bid.
    function bid() external payable {
        if (block.timestamp > auctionEndTime) {
            revert AuctionAlreadyEnded();
        }

        uint256 requiredBid = getMinimumRequiredBid();

        // Reuse funds the caller already has in the contract:
        //  - `credit`: refundable amount from a previous bid that was outbid;
        //  - `staked`: their current live bid, if they are still the highest
        //    bidder (topping up their own bid rather than bidding against
        //    themselves).
        uint256 credit = pendingReturns[msg.sender];
        uint256 staked = msg.sender == highestBidder ? highestBid : 0;
        uint256 totalBid = credit + staked + msg.value;

        if (totalBid < requiredBid) {
            revert BidNotHighEnough(requiredBid);
        }

        // The caller's credit is now committed to this bid.
        if (credit != 0) {
            pendingReturns[msg.sender] = 0;
        }

        // Refund the previous highest bidder — unless that is the caller, whose
        // stake is already rolled into `totalBid` above rather than refunded.
        if (highestBid != 0 && highestBidder != msg.sender) {
            pendingReturns[highestBidder] += highestBid;
        }

        highestBidder = msg.sender;
        highestBid = totalBid;

        emit HighestBidIncreased(msg.sender, totalBid);
    }

    /// Withdraw a bid that was overbid.
    function withdraw() external returns (bool) {
        uint256 amount = pendingReturns[msg.sender];

        if (amount > 0) {
            // Effects
            pendingReturns[msg.sender] = 0;

            // Interaction
            (bool success, ) = payable(msg.sender).call{value: amount}("");

            if (!success) {
                pendingReturns[msg.sender] = amount;
                return false;
            }
        }

        return true;
    }

    /// End the auction and send the highest bid
    /// to the beneficiary.
    function auctionEnd() external {
        // 1. Conditions
        if (block.timestamp < auctionEndTime) {
            revert AuctionNotYetEnded();
        }

        if (ended) {
            revert AuctionEndAlreadyCalled();
        }

        // 2. Effects
        ended = true;

        emit AuctionEnded(highestBidder, highestBid);

        // 3. Interaction
        (bool success, ) = beneficiary.call{value: highestBid}("");
        require(success, "Transfer failed");
    }
}
