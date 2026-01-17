// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Player - A Soulbound ERC721 token representing a player in KusaMine
/// @author KusaMine Team
/// @notice This contract manages player tokens that are non-transferable (soulbound)
/// @dev Players must purchase their token to play the game. Each wallet can only own one token.
contract Player is ERC721, Ownable {
    uint256 private _tokenIdCounter;
    uint256 private _price;
    IERC20 private _upgradeToken;
    uint256 private _upgradeCost;

    /// @notice Thrown when attempting to transfer a soulbound token
    error PlayerIsSoulbound();

    /// @notice Enumeration of player attributes that can be upgraded
    enum Attribute { Strength, Dexterity, Intelligence, Luck }

    /// @notice Struct containing all player attributes
    /// @param strenght The player's strength stat
    /// @param dexterity The player's dexterity stat
    /// @param intelligence The player's intelligence stat
    /// @param luck The player's luck stat
    struct Attributes {
        uint64 strenght;
        uint64 dexterity;
        uint64 intelligence;
        uint64 luck;
    }

    /// @notice Mapping from token ID to its attributes
    mapping(uint256 tokenId => Attributes) private _tokenAttributes;

    /// @notice Initializes the Player contract
    /// @param price The price in native currency to mint a player token
    /// @param upgradeToken The ERC20 token address used for attribute upgrades
    constructor(uint256 price, address upgradeToken) ERC721("KusaMine Player", "KMPLAYER") Ownable(msg.sender) {
        _price = price;
        _upgradeToken = IERC20(upgradeToken);
    }

    /// @notice Purchase a player token to join the game
    /// @dev Each wallet can only own one token. The token is soulbound and cannot be transferred.
    ///      Could later be extended to only allow PoPs (Proof of Personhood) to fight botting.
    function buyToken() public payable {
        require(msg.value >= _price, "Amount must be greater than or equal to the price");
        require(balanceOf(msg.sender) == 0, "Player already has a token");
        _tokenIdCounter += 1;
        _safeMint(msg.sender, _tokenIdCounter);
        _tokenAttributes[_tokenIdCounter] = Attributes(10, 10, 10, 10);
    }

    /// @notice Returns the total number of tokens minted
    /// @return The current token ID counter value
    function getTokenIdCounter() public view returns (uint256) {
        return _tokenIdCounter;
    }

    /// @notice Updates the price to mint a player token
    /// @dev Only callable by the contract owner. Price is in native currency (KSM).
    ///      This allows adjusting for market volatility. Could switch to dotStablecoin or airdrops with PoP.
    /// @param price The new price in native currency
    function updatePrice(uint256 price) external onlyOwner {
        _price = price;
    }

    /// @notice Returns the current price to mint a player token
    /// @return The price in native currency
    function getPrice() public view returns (uint256) {
        return _price;
    }

    /// @notice Returns the attributes for a given token
    /// @param tokenId The ID of the token to query
    /// @return The Attributes struct for the token
    function getAttributes(uint256 tokenId) public view returns (Attributes memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _tokenAttributes[tokenId];
    }

    /// @notice Sets the ERC20 token used for attribute upgrades
    /// @dev Only callable by the contract owner
    /// @param token The address of the ERC20 token
    function setUpgradeToken(address token) external onlyOwner {
        _upgradeToken = IERC20(token);
    }

    /// @notice Sets the cost in ERC20 tokens to upgrade an attribute
    /// @dev Only callable by the contract owner
    /// @param cost The cost per upgrade in ERC20 token units
    function setUpgradeCost(uint256 cost) external onlyOwner {
        _upgradeCost = cost;
    }

    /// @notice Returns the address of the ERC20 token used for upgrades
    /// @return The upgrade token address
    function getUpgradeToken() public view returns (address) {
        return address(_upgradeToken);
    }

    /// @notice Returns the cost to upgrade an attribute
    /// @return The upgrade cost in ERC20 token units
    function getUpgradeCost() public view returns (uint256) {
        return _upgradeCost;
    }

    /// @notice Upgrades a specific attribute by paying with ERC20 tokens
    /// @dev Caller must have approved this contract to spend the upgrade cost.
    ///      Only the token owner can upgrade their attributes.
    /// @param tokenId The ID of the player token to upgrade
    /// @param attribute The attribute to increment by 1
    function upgradeAttribute(uint256 tokenId, Attribute attribute) external {
        require(ownerOf(tokenId) == msg.sender, "Not the token owner");
        require(address(_upgradeToken) != address(0), "Upgrade token not set");
        require(_upgradeCost > 0, "Upgrade cost not set");

        bool success = _upgradeToken.transferFrom(msg.sender, address(this), _upgradeCost);
        require(success, "Token transfer failed");

        if (attribute == Attribute.Strength) {
            _tokenAttributes[tokenId].strenght += 1;
        } else if (attribute == Attribute.Dexterity) {
            _tokenAttributes[tokenId].dexterity += 1;
        } else if (attribute == Attribute.Intelligence) {
            _tokenAttributes[tokenId].intelligence += 1;
        } else if (attribute == Attribute.Luck) {
            _tokenAttributes[tokenId].luck += 1;
        }
    }

    /// @notice Internal function to enforce soulbound behavior
    /// @dev Overrides ERC721's _update to block transfers. Only minting (from==0) and burning (to==0) are allowed.
    /// @param to The address receiving the token
    /// @param tokenId The token ID being transferred
    /// @param auth The address authorized to make the transfer
    /// @return from The previous owner of the token
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address from)
    {
        from = _ownerOf(tokenId);

        // Block transfers: only allow mint (from==0) and burn (to==0)
        // allowing burns for now, maybe later i could not allow people to burn their token.
        if (from != address(0) && to != address(0)) revert PlayerIsSoulbound();

        return super._update(to, tokenId, auth);
    }
}
