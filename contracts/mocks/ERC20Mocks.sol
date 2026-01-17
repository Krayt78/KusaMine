// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20 - A standard ERC20 token for testing
/// @dev Allows minting tokens for testing purposes
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockERC20ReturnsFalse - An ERC20 that returns false on transferFrom
/// @dev Used for testing the "Token transfer failed" revert case
contract MockERC20ReturnsFalse {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

/// @title MaliciousERC20 - An ERC20 that reenters during transferFrom
/// @dev Used for testing reentrancy protection
interface IPlayer {
    function upgradeAttribute(uint256 tokenId, uint8 attribute) external;
}

contract MaliciousERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public targetPlayer;
    uint256 public targetTokenId;
    uint8 public targetAttribute;
    bool public shouldReenter;
    bool public reentered;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function setReentrancyParams(address player, uint256 tokenId, uint8 attribute) external {
        targetPlayer = player;
        targetTokenId = tokenId;
        targetAttribute = attribute;
        shouldReenter = true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;

        // Attempt reentrancy
        if (shouldReenter && !reentered) {
            reentered = true;
            // Try to call upgradeAttribute again during the transfer
            IPlayer(targetPlayer).upgradeAttribute(targetTokenId, targetAttribute);
        }

        return true;
    }
}
