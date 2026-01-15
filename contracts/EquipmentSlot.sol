// contracts/EquipmentSlot.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title EquipmentSlot
/// @notice Library defining equipment slot types for the game
library EquipmentSlot {
    enum Slot {
        ARMOR,
        WEAPON,
        RELIC
    }
}