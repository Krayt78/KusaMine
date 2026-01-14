// contracts/systems/InventorySystem.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../ComponentRegistry.sol";
import "../components/InventoryComponent.sol";
import "../interfaces/IEquipable.sol";
import "../Player.sol";

contract InventorySystem {
    ComponentRegistry private _registry;
    Player private _playerContract;
    
    bytes32 private constant INVENTORY_COMPONENT = keccak256("InventoryComponent");
    
    event ItemEquipped(
        uint256 indexed playerId,
        InventoryComponent.EquipmentSlot indexed slot,
        address indexed nftContract,
        uint256 tokenId
    );
    
    event ItemUnequipped(
        uint256 indexed playerId,
        InventoryComponent.EquipmentSlot indexed slot
    );
    
    constructor(address registry, address playerContract) {
        _registry = ComponentRegistry(registry);
        _playerContract = Player(playerContract);
    }
    
    function equip(
        uint256 playerId,
        InventoryComponent.EquipmentSlot slot,
        address nftContract,
        uint256 tokenId
    ) external {
        // Verify player ownership
        require(_playerContract.ownerOf(playerId) == msg.sender, "Not owner");
        
        // Check if it's ERC721 or ERC1155 and verify ownership
        bool isERC1155 = IERC165(nftContract).supportsInterface(type(IERC1155).interfaceId);
        bool isERC721 = IERC165(nftContract).supportsInterface(type(IERC721).interfaceId);
        
        require(isERC1155 || isERC721, "Contract must be ERC721 or ERC1155");
        
        if (isERC1155) {
            IERC1155 nft = IERC1155(nftContract);
            require(nft.balanceOf(msg.sender, tokenId) > 0, "Not NFT owner");
        } else {
            IERC721 nft = IERC721(nftContract);
            require(nft.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        }
        
        // Verify the item is equipable and matches the slot (if IEquipable is supported)
        if (IERC165(nftContract).supportsInterface(type(IEquipable).interfaceId)) {
            IEquipable equipable = IEquipable(nftContract);
            InventoryComponent.EquipmentSlot itemSlot = equipable.getEquipmentSlot(tokenId);
            require(itemSlot == slot, "Item slot mismatch");
        }
        
        // Get inventory component
        address inventoryComponentAddr = _registry.getComponent(INVENTORY_COMPONENT);
        require(inventoryComponentAddr != address(0), "InventoryComponent not registered");
        
        InventoryComponent inventory = InventoryComponent(inventoryComponentAddr);
        
        // Unequip existing item if any
        if (inventory.isEquipped(playerId, slot)) {
            inventory.unequip(playerId, slot, address(this));
        }
        
        // Equip new item
        inventory.equip(playerId, slot, nftContract, tokenId, address(this));
        
        emit ItemEquipped(playerId, slot, nftContract, tokenId);
    }
    
    function unequip(
        uint256 playerId,
        InventoryComponent.EquipmentSlot slot
    ) external {
        // Verify player ownership
        require(_playerContract.ownerOf(playerId) == msg.sender, "Not owner");
        
        // Get inventory component
        address inventoryComponentAddr = _registry.getComponent(INVENTORY_COMPONENT);
        require(inventoryComponentAddr != address(0), "InventoryComponent not registered");
        
        InventoryComponent inventory = InventoryComponent(inventoryComponentAddr);
        
        // Verify something is equipped
        require(inventory.isEquipped(playerId, slot), "Slot is empty");
        
        // Unequip item
        inventory.unequip(playerId, slot, address(this));
        
        emit ItemUnequipped(playerId, slot);
    }
    
    function getEquipped(
        uint256 playerId,
        InventoryComponent.EquipmentSlot slot
    ) external view returns (address nftContract, uint256 tokenId) {
        address inventoryComponentAddr = _registry.getComponent(INVENTORY_COMPONENT);
        require(inventoryComponentAddr != address(0), "InventoryComponent not registered");
        
        InventoryComponent inventory = InventoryComponent(inventoryComponentAddr);
        return inventory.getEquipped(playerId, slot);
    }
    
    function getAllEquipped(uint256 playerId)
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
        address inventoryComponentAddr = _registry.getComponent(INVENTORY_COMPONENT);
        require(inventoryComponentAddr != address(0), "InventoryComponent not registered");
        
        InventoryComponent inventory = InventoryComponent(inventoryComponentAddr);
        return inventory.getAllEquipped(playerId);
    }
}