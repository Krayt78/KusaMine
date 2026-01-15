// contracts/equipables/Armor.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../Equipable.sol";
import "../EquipmentSlot.sol";

/// @title Armor
/// @notice Armor items that can be equipped to the ARMOR slot
contract Armor is Equipable {
    constructor(string memory uri, address initialOwner)
        Equipable(uri, initialOwner)
    {}
    
    /// @notice Create armor token type - automatically sets slot to ARMOR
    function createArmorType(
        address to,
        uint256 amount,
        bytes memory itemData
    ) external onlyOwner returns (uint256) {
        return createTokenType(to, amount, EquipmentSlot.Slot.ARMOR, itemData);
    }
}