// contracts/EquipmentVault.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./EquipmentSlot.sol";
import "./interfaces/IEquipable.sol";

/// @title EquipmentVault
/// @notice Manages equipment slots and custody of equipped items for players
/// @dev This contract holds ERC-1155 items in custody when equipped
/// @dev Inherited by Player contract to provide equipment functionality
abstract contract EquipmentVault is ERC165, IERC1155Receiver {
    struct EquippedItem {
        uint256 tokenType;        // The ERC-1155 token type ID
        uint256 amount;           // Amount equipped (usually 1)
    }

    /// @notice The cached equipment contract address
    address private _equipmentContract;

    // Mapping: playerTokenId => slot => equipped item info
    mapping(uint256 => mapping(EquipmentSlot.Slot => EquippedItem)) private _equippedItems;

    // Mapping: playerTokenId => tokenType => amount
    // Tracks total vault balance per player for each token type
    mapping(uint256 => mapping(uint256 => uint256)) private _vaultBalances;

    // Events
    event ItemEquipped(
        uint256 indexed playerTokenId,
        EquipmentSlot.Slot indexed slot,
        uint256 tokenType,
        uint256 amount
    );

    event ItemUnequipped(
        uint256 indexed playerTokenId,
        EquipmentSlot.Slot indexed slot,
        uint256 tokenType,
        uint256 amount
    );

    event EquipmentContractSet(address indexed equipmentContract);

    /// @notice Set the equipment contract address
    /// @dev Can only be set once (when it's address(0))
    /// @param equipmentContract The equipment contract address
    function _setEquipmentContract(address equipmentContract) internal {
        require(_equipmentContract == address(0), "Equipment contract already set");
        require(equipmentContract != address(0), "Invalid equipment contract");
        _equipmentContract = equipmentContract;
        emit EquipmentContractSet(equipmentContract);
    }

    /// @notice Get the equipment contract address
    /// @return The cached equipment contract address
    function getEquipmentContract() external view returns (address) {
        return _equipmentContract;
    }

    /// @notice Equip an item to a specific slot
    /// @param playerTokenId The player's token ID
    /// @param slot The equipment slot to equip to
    /// @param tokenType The ERC-1155 token type ID
    /// @param amount The amount to equip (usually 1)
    function equip(
        uint256 playerTokenId,
        EquipmentSlot.Slot slot,
        uint256 tokenType,
        uint256 amount
    ) external {
        require(_equipmentContract != address(0), "Equipment contract not set");

        // Verify the caller owns the player token
        require(_ownsPlayerToken(playerTokenId), "Not player owner");

        // Verify the item contract implements IEquipable
        IEquipable equipableContract = IEquipable(_equipmentContract);
        require(
            equipableContract.getEquipmentSlot(tokenType) == slot,
            "Item slot mismatch"
        );

        // Verify the player owns the item
        IERC1155 itemContract = IERC1155(_equipmentContract);
        require(
            itemContract.balanceOf(msg.sender, tokenType) >= amount,
            "Insufficient item balance"
        );

        // If slot is already occupied, unequip first
        EquippedItem memory currentItem = _equippedItems[playerTokenId][slot];
        if (currentItem.amount > 0) {
            _unequipInternal(playerTokenId, slot);
        }

        // Transfer item from player to vault
        itemContract.safeTransferFrom(
            msg.sender,
            address(this),
            tokenType,
            amount,
            ""
        );

        // Record equipped item
        _equippedItems[playerTokenId][slot] = EquippedItem({
            tokenType: tokenType,
            amount: amount
        });

        // Update vault balance
        _vaultBalances[playerTokenId][tokenType] += amount;

        emit ItemEquipped(playerTokenId, slot, tokenType, amount);
    }

    /// @notice Unequip an item from a specific slot
    /// @param playerTokenId The player's token ID
    /// @param slot The equipment slot to unequip from
    function unequip(uint256 playerTokenId, EquipmentSlot.Slot slot) external {
        require(_ownsPlayerToken(playerTokenId), "Not player owner");
        _unequipInternal(playerTokenId, slot);
    }

    /// @notice Internal function to unequip an item
    /// @param playerTokenId The player's token ID
    /// @param slot The equipment slot to unequip from
    function _unequipInternal(uint256 playerTokenId, EquipmentSlot.Slot slot) internal {
        EquippedItem memory item = _equippedItems[playerTokenId][slot];
        require(item.amount > 0, "Slot is empty");

        // Update vault balance
        _vaultBalances[playerTokenId][item.tokenType] -= item.amount;

        // Transfer item back to player
        IERC1155 itemContract = IERC1155(_equipmentContract);
        itemContract.safeTransferFrom(
            address(this),
            msg.sender,
            item.tokenType,
            item.amount,
            ""
        );

        // Clear equipped item
        delete _equippedItems[playerTokenId][slot];

        emit ItemUnequipped(
            playerTokenId,
            slot,
            item.tokenType,
            item.amount
        );
    }

    /// @notice Get equipped item info for a player's slot
    /// @param playerTokenId The player's token ID
    /// @param slot The equipment slot to query
    /// @return tokenType The token type ID
    /// @return amount The amount equipped
    function getEquippedItem(uint256 playerTokenId, EquipmentSlot.Slot slot)
        external
        view
        returns (
            uint256 tokenType,
            uint256 amount
        )
    {
        EquippedItem memory item = _equippedItems[playerTokenId][slot];
        return (item.tokenType, item.amount);
    }

    /// @notice Check if a slot is equipped
    /// @param playerTokenId The player's token ID
    /// @param slot The equipment slot to check
    /// @return True if the slot has an equipped item
    function isSlotEquipped(uint256 playerTokenId, EquipmentSlot.Slot slot)
        external
        view
        returns (bool)
    {
        return _equippedItems[playerTokenId][slot].amount > 0;
    }

    /// @notice Get vault balance for a specific token type
    /// @param playerTokenId The player's token ID
    /// @param tokenType The token type ID
    /// @return The amount of tokens held in vault for this player
    function getVaultBalance(
        uint256 playerTokenId,
        uint256 tokenType
    ) external view returns (uint256) {
        return _vaultBalances[playerTokenId][tokenType];
    }

    /// @notice Check if the caller owns the player token
    /// @dev Must be implemented by the inheriting contract (Player)
    /// @param playerTokenId The player token ID to check
    /// @return True if the caller owns the token
    function _ownsPlayerToken(uint256 playerTokenId) internal view virtual returns (bool);

    /// @notice ERC165 support
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC165, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /// @notice ERC1155Receiver implementation - required to receive tokens
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    /// @notice ERC1155Receiver implementation for batch transfers
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
