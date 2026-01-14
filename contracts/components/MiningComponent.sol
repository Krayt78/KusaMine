// contracts/components/MiningComponent.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MiningComponent {
    mapping(uint256 => uint256) private _miningPower;
    mapping(uint256 => uint256) private _lastMineTime;
    
    modifier onlySystem(address system) {
        require(system != address(0), "Invalid system");
        _;
    }
    
    function setMiningPower(uint256 entityId, uint256 power, address system) 
        external 
        onlySystem(system) 
    {
        _miningPower[entityId] = power;
    }
    
    function setLastMineTime(uint256 entityId, uint256 time, address system) 
        external 
        onlySystem(system) 
    {
        _lastMineTime[entityId] = time;
    }
    
    function getMiningPower(uint256 entityId) external view returns (uint256) {
        return _miningPower[entityId];
    }
    
    function getLastMineTime(uint256 entityId) external view returns (uint256) {
        return _lastMineTime[entityId];
    }
}