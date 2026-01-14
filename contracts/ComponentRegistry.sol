// contracts/ComponentRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ComponentRegistry is Ownable(msg.sender) {
    // Mapping: component name => component address
    mapping(bytes32 => address) private _components;
    
    // Mapping: system address => authorized (true/false)
    mapping(address => bool) private _authorizedSystems;
    
    event ComponentRegistered(bytes32 indexed name, address indexed component);
    event SystemAuthorized(address indexed system, bool authorized);
    
    function registerComponent(bytes32 name, address component) external onlyOwner {
        require(component != address(0), "Invalid component address");
        _components[name] = component;
        emit ComponentRegistered(name, component);
    }
    
    function authorizeSystem(address system, bool authorized) external onlyOwner {
        _authorizedSystems[system] = authorized;
        emit SystemAuthorized(system, authorized);
    }
    
    function getComponent(bytes32 name) external view returns (address) {
        return _components[name];
    }
    
    function isSystemAuthorized(address system) external view returns (bool) {
        return _authorizedSystems[system];
    }
    
    // Helper to verify system authorization
    modifier onlyAuthorizedSystem() {
        require(_authorizedSystems[msg.sender], "Unauthorized system");
        _;
    }
}