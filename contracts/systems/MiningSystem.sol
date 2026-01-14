// contracts/systems/MiningSystem.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../ComponentRegistry.sol";
import "../components/MiningComponent.sol";
import "../Player.sol";

contract MiningSystem {
    ComponentRegistry private _registry;
    Player private _playerContract;
    
    bytes32 private constant MINING_COMPONENT = keccak256("MiningComponent");
    
    uint256 public constant MINE_COOLDOWN = 1 hours;
    
    constructor(address registry, address playerContract) {
        _registry = ComponentRegistry(registry);
        _playerContract = Player(playerContract);
    }
    
    function mine(uint256 playerId) external {
        require(_playerContract.ownerOf(playerId) == msg.sender, "Not owner");
        
        address miningComponentAddr = _registry.getComponent(MINING_COMPONENT);
        
        require(miningComponentAddr != address(0), "MiningComponent not registered");
        
        MiningComponent miningComponent = MiningComponent(miningComponentAddr);
        
        uint256 lastMineTime = miningComponent.getLastMineTime(playerId);
        require(block.timestamp >= lastMineTime + MINE_COOLDOWN, "Cooldown active");
        
        uint256 miningPower = miningComponent.getMiningPower(playerId);

        // Update last mine time
        miningComponent.setLastMineTime(playerId, block.timestamp, address(this));
    }
}