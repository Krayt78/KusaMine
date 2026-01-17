// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../interfaces/IEquipable.sol";

/// @title MockEquipment - A test contract for EquipmentVault testing
/// @dev Exposes createTokenType as public for testing purposes
contract MockEquipment is ERC1155, IEquipable {
    uint256 private _tokenTypeCounter;

    struct EquipmentData {
        EquipmentSlot.Slot slot;
        bytes itemData;
    }

    mapping(uint256 => EquipmentData) private _equipment;

    constructor() ERC1155("") {}

    /// @notice Create a new token type and mint initial supply
    /// @param to Address to mint the items to
    /// @param amount Amount of items to mint
    /// @param slot The equipment slot this item can be equipped to
    /// @param itemData Optional encoded data for the item
    /// @return tokenType The newly created token type ID
    function createTokenType(
        address to,
        uint256 amount,
        EquipmentSlot.Slot slot,
        bytes memory itemData
    ) external returns (uint256 tokenType) {
        _tokenTypeCounter += 1;
        tokenType = _tokenTypeCounter;

        _equipment[tokenType] = EquipmentData({
            slot: slot,
            itemData: itemData
        });

        _mint(to, tokenType, amount, "");
    }

    /// @notice Mint more copies of an existing token type
    function mint(
        address to,
        uint256 tokenType,
        uint256 amount
    ) external {
        require(_tokenTypeCounter >= tokenType && tokenType > 0, "Token type does not exist");
        _mint(to, tokenType, amount, "");
    }

    /// @notice Get the equipment slot for a token type
    function getEquipmentSlot(uint256 tokenType)
        external
        view
        override
        returns (EquipmentSlot.Slot)
    {
        require(_tokenTypeCounter >= tokenType && tokenType > 0, "Token type does not exist");
        return _equipment[tokenType].slot;
    }

    /// @notice Get item data for a token type
    function getItemData(uint256 tokenType)
        external
        view
        override
        returns (bytes memory)
    {
        require(_tokenTypeCounter >= tokenType && tokenType > 0, "Token type does not exist");
        return _equipment[tokenType].itemData;
    }

    /// @notice Get total number of token types created
    function totalTokenTypes() external view returns (uint256) {
        return _tokenTypeCounter;
    }
}
