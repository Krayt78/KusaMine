// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Player is a SoulBound token that is used to represent a player in the game.
// It is a ERC721 token that is minted to a player when they create an account.
// They have to buy the token to play the game.
contract Player is ERC721, Ownable {
    uint256 private _tokenIdCounter;
    uint256 private _price;
    IERC20 private _upgradeToken;
    uint256 private _upgradeCost;

    error PlayerIsSoulbound();

    enum Attribute { Strength, Dexterity, Intelligence, Luck }

    struct Attributes {
        uint64 strenght;
        uint64 dexterity;
        uint64 intelligence;
        uint64 luck;
    }

    mapping(uint256 tokenId => Attributes) private _tokenAttributes;

    constructor(uint256 price, address upgradeToken) ERC721("KusaMine Player", "KMPLAYER") Ownable(msg.sender) {
        _price = price;
        _upgradeToken = IERC20(upgradeToken);
    }

    // Buy the token to play the game.
    // The player has to pay the price to buy the token.
    // The token is minted to the player.
    // The token is soulbound and cannot be transferred.
    // Each wallet can only have one token. 
    // This could later be extended to only allow PoPs to buy the token to fight botting.
    function buyToken() public payable {
        require(msg.value >= _price, "Amount must be greater than or equal to the price");
        require(balanceOf(msg.sender) == 0, "Player already has a token");
        _tokenIdCounter += 1;
        _safeMint(msg.sender, _tokenIdCounter);
        _tokenAttributes[_tokenIdCounter] = Attributes(10, 10, 10, 10);
    }

    function getTokenIdCounter() public view returns (uint256) {
        return _tokenIdCounter;
    }

    // To help the ecosystem the price will be in KSM.
    // This is used to update the price of the token in case of a brutal change in the market.
    // Could switch to using the dotStablecoin or even aidroping them once we have POP.
    function updatePrice(uint256 price) external onlyOwner {
        _price = price;
    }

    function getPrice() public view returns (uint256) {
        return _price;
    }

    function getAttributes(uint256 tokenId) public view returns (Attributes memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _tokenAttributes[tokenId];
    }

    function setUpgradeToken(address token) external onlyOwner {
        _upgradeToken = IERC20(token);
    }

    function setUpgradeCost(uint256 cost) external onlyOwner {
        _upgradeCost = cost;
    }

    function getUpgradeToken() public view returns (address) {
        return address(_upgradeToken);
    }

    function getUpgradeCost() public view returns (uint256) {
        return _upgradeCost;
    }

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

    // This is to enforce the soulbound nature of the token.
    // This every transfer must go through this function.
    // so we revert immediately if its not a mint or burn.
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