// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IPlayer {
    function buyToken() external payable;
}

/// @title NonERC721Receiver - A contract that does NOT implement IERC721Receiver
/// @dev Used for testing that _safeMint reverts when receiver doesn't implement the interface
contract NonERC721Receiver {
    function callBuyToken(address player) external payable {
        IPlayer(player).buyToken{value: msg.value}();
    }
}

/// @title ERC721ReceiverMock - A contract that implements IERC721Receiver
/// @dev Used for testing that _safeMint succeeds when receiver implements the interface
contract ERC721ReceiverMock is IERC721Receiver {
    function callBuyToken(address player) external payable {
        IPlayer(player).buyToken{value: msg.value}();
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
