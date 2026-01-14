// contracts/Equipable.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IEquipable.sol";
import "./components/InventoryComponent.sol";

/// @title Equipable
/// @notice Base contract for all equipable items (armor, weapons, relics)
/// @dev Each token type stores its equipment slot type and can have custom metadata
/// @dev Uses ERC1155 for gas-efficient batch operations and multiple token types
abstract contract Equipable is ERC1155, Ownable, IEquipable {
    using Strings for uint256;
    
    uint256 private _tokenTypeCounter;
    
    // Mapping: tokenType => equipment slot
    mapping(uint256 => InventoryComponent.EquipmentSlot) private _equipmentSlots;
    
    // Mapping: tokenType => item data (for stats, rarity, etc.)
    mapping(uint256 => bytes) private _itemData;
    
    // Base URI for token metadata
    string private _baseTokenURI;
    
    event ItemTypeCreated(
        uint256 indexed tokenType,
        InventoryComponent.EquipmentSlot indexed slot,
        bytes itemData
    );
    
    constructor(
        string memory _uri,
        address initialOwner
    ) ERC1155(_uri) Ownable(initialOwner) {
        _baseTokenURI = _uri;
    }
    
    /// @notice Create a new token type and mint initial supply
    /// @param to Address to mint the items to
    /// @param amount Amount of items to mint (usually 1 for unique items)
    /// @param slot The equipment slot this item can be equipped to
    /// @param itemData Optional encoded data for the item (stats, rarity, etc.)
    /// @return tokenType The newly created token type ID
    function createTokenType(
        address to,
        uint256 amount,
        InventoryComponent.EquipmentSlot slot,
        bytes memory itemData
    ) internal onlyOwner returns (uint256 tokenType) {
        _tokenTypeCounter += 1;
        tokenType = _tokenTypeCounter;
        
        _equipmentSlots[tokenType] = slot;
        _itemData[tokenType] = itemData;
        
        _mint(to, tokenType, amount, "");
        
        emit ItemTypeCreated(tokenType, slot, itemData);
    }
    
    /// @notice Mint more copies of an existing token type
    /// @param to Address to mint the items to
    /// @param tokenType The token type ID
    /// @param amount Amount of items to mint
    function mint(
        address to,
        uint256 tokenType,
        uint256 amount
    ) external onlyOwner {
        require(_equipmentSlots[tokenType] != InventoryComponent.EquipmentSlot.ARMOR || 
                _equipmentSlots[tokenType] != InventoryComponent.EquipmentSlot.WEAPON ||
                _equipmentSlots[tokenType] != InventoryComponent.EquipmentSlot.RELIC ||
                _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.ARMOR ||
                _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.WEAPON ||
                _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.RELIC,
                "Token type does not exist");
        _mint(to, tokenType, amount, "");
    }
    
    /// @notice Batch create multiple token types
    function batchCreateTokenTypes(
        address[] calldata to,
        uint256[] calldata amounts,
        InventoryComponent.EquipmentSlot[] calldata slots,
        bytes[] calldata itemDataArray
    ) external onlyOwner {
        require(
            to.length == amounts.length && 
            amounts.length == slots.length && 
            slots.length == itemDataArray.length,
            "Array length mismatch"
        );
        
        uint256[] memory tokenTypes = new uint256[](to.length);
        for (uint256 i = 0; i < to.length; i++) {
            _tokenTypeCounter += 1;
            tokenTypes[i] = _tokenTypeCounter;
            _equipmentSlots[tokenTypes[i]] = slots[i];
            _itemData[tokenTypes[i]] = itemDataArray[i];
            emit ItemTypeCreated(tokenTypes[i], slots[i], itemDataArray[i]);
        }
        
        // Batch mint all token types
        for (uint256 i = 0; i < to.length; i++) {
            _mint(to[i], tokenTypes[i], amounts[i], "");
        }
    }
    
    /// @notice Get the equipment slot for a token type
    function getEquipmentSlot(uint256 tokenType) 
        external 
        view 
        override 
        returns (InventoryComponent.EquipmentSlot) 
    {
        require(_equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.ARMOR ||
                _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.WEAPON ||
                _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.RELIC,
                "Token type does not exist");
        return _equipmentSlots[tokenType];
    }
    
    /// @notice Get item data for a token type
    function getItemData(uint256 tokenType) 
        external 
        view 
        override 
        returns (bytes memory) 
    {
        require(_equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.ARMOR ||
                _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.WEAPON ||
                _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.RELIC,
                "Token type does not exist");
        return _itemData[tokenType];
    }
    
    /// @notice Set base URI for token metadata
    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
        _baseTokenURI = newuri;
    }
    
    /// @notice Get token URI (ERC1155 uses uri() instead of tokenURI())
    function uri(uint256 tokenType) 
        public 
        view 
        override 
        returns (string memory) 
    {
        return bytes(_baseTokenURI).length > 0 
            ? string(abi.encodePacked(_baseTokenURI, tokenType.toString()))
            : "";
    }
    
    /// @notice Get total number of token types created
    function totalTokenTypes() external view returns (uint256) {
        return _tokenTypeCounter;
    }
    
    /// @notice Check if a token type exists
    function tokenTypeExists(uint256 tokenType) external view returns (bool) {
        return _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.ARMOR ||
               _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.WEAPON ||
               _equipmentSlots[tokenType] == InventoryComponent.EquipmentSlot.RELIC;
    }
}