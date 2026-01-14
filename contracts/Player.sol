// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Player is a SoulBound token that is used to represent a player in the game.
// It is a ERC721 token that is minted to a player when they create an account.
// They have to buy the token to play the game.
contract Player is ERC721, Ownable {
    uint256 private _tokenIdCounter;
    uint256 private _price;

    error PlayerIsSoulbound();

    constructor(uint256 price) ERC721("KusaMine Player", "KMPLAYER") Ownable(msg.sender) {
        _price = price;
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