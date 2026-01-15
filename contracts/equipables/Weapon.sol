// contracts/equipables/Weapon.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../Equipable.sol";
import "../EquipmentSlot.sol";

/// @title Weapon
/// @notice Weapon items that can be equipped to the WEAPON slot
contract Weapon is Equipable {
    constructor(string memory uri, address initialOwner)
        Equipable(uri, initialOwner)
    {}
    
    /// @notice Create weapon token type - automatically sets slot to WEAPON
    function createWeaponType(
        address to,
        uint256 amount,
        bytes memory itemData
    ) external onlyOwner returns (uint256) {
        return createTokenType(to, amount, EquipmentSlot.Slot.WEAPON, itemData);
    }
}