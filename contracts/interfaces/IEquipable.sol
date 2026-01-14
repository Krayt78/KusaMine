// contracts/interfaces/IEquipable.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../components/InventoryComponent.sol";

interface IEquipable {
    /// @notice Returns the equipment slot this item can be equipped to
    /// @param tokenId The token ID to check
    /// @return The equipment slot type
    function getEquipmentSlot(uint256 tokenId) external view returns (InventoryComponent.EquipmentSlot);
    
    /// @notice Returns item metadata/stats
    /// @param tokenId The token ID to check
    /// @return A bytes array containing encoded item data (can be decoded off-chain or on-chain)
    function getItemData(uint256 tokenId) external view returns (bytes memory);
}