// contracts/equipables/Relic.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../Equipable.sol";
import "../EquipmentSlot.sol";

/// @title Relic
/// @notice Relic items that can be equipped to the RELIC slot
contract Relic is Equipable {
    constructor(string memory uri, address initialOwner)
        Equipable(uri, initialOwner)
    {}
    
    /// @notice Create relic token type - automatically sets slot to RELIC
    function createRelicType(
        address to,
        uint256 amount,
        bytes memory itemData
    ) external onlyOwner returns (uint256) {
        return createTokenType(to, amount, EquipmentSlot.Slot.RELIC, itemData);
    }
}