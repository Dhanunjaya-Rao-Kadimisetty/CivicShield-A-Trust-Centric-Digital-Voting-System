// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VoteLedger {

    // Store vote receipt hashes
    mapping(bytes32 => bool) private storedReceipts;

    // Event emitted when vote is recorded
    event VoteRecorded(bytes32 receiptHash, uint256 timestamp);

    // Store a vote receipt hash
    function storeVote(bytes32 receiptHash) public {
        require(!storedReceipts[receiptHash], "Vote already recorded");

        storedReceipts[receiptHash] = true;

        emit VoteRecorded(receiptHash, block.timestamp);
    }

    // Verify if a receipt exists
    function verifyVote(bytes32 receiptHash) public view returns (bool) {
        return storedReceipts[receiptHash];
    }
}
