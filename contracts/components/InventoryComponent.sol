// contracts/components/InventoryComponent.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract InventoryComponent {
    // Equipment slot types
    enum EquipmentSlot {
        ARMOR,
        WEAPON,
        RELIC
    }
    
    // Mapping: entityId => slot => (contract address, tokenId)
    mapping(uint256 => mapping(EquipmentSlot => address)) private _equippedContracts;
    mapping(uint256 => mapping(EquipmentSlot => uint256)) private _equippedTokenIds;
    
    modifier onlySystem(address system) {
        require(system != address(0), "Invalid system");
        _;
    }
    
    // Equip an NFT to a specific slot
    function equip(
        uint256 entityId,
        EquipmentSlot slot,
        address nftContract,
        uint256 tokenId,
        address system
    ) external onlySystem(system) {
        _equippedContracts[entityId][slot] = nftContract;
        _equippedTokenIds[entityId][slot] = tokenId;
    }
    
    // Unequip an item from a specific slot
    function unequip(
        uint256 entityId,
        EquipmentSlot slot,
        address system
    ) external onlySystem(system) {
        _equippedContracts[entityId][slot] = address(0);
        _equippedTokenIds[entityId][slot] = 0;
    }
    
    // Get equipped item info for a slot
    function getEquipped(
        uint256 entityId,
        EquipmentSlot slot
    ) external view returns (address nftContract, uint256 tokenId) {
        return (
            _equippedContracts[entityId][slot],
            _equippedTokenIds[entityId][slot]
        );
    }
    
    // Check if a slot is equipped
    function isEquipped(
        uint256 entityId,
        EquipmentSlot slot
    ) external view returns (bool) {
        return _equippedContracts[entityId][slot] != address(0);
    }
    
    // Get all equipped items for an entity
    function getAllEquipped(uint256 entityId)
        external
        view
        returns (
            address armorContract,
            uint256 armorTokenId,
            address weaponContract,
            uint256 weaponTokenId,
            address relicContract,
            uint256 relicTokenId
        )
    {
        return (
            _equippedContracts[entityId][EquipmentSlot.ARMOR],
            _equippedTokenIds[entityId][EquipmentSlot.ARMOR],
            _equippedContracts[entityId][EquipmentSlot.WEAPON],
            _equippedTokenIds[entityId][EquipmentSlot.WEAPON],
            _equippedContracts[entityId][EquipmentSlot.RELIC],
            _equippedTokenIds[entityId][EquipmentSlot.RELIC]
        );
    }
}