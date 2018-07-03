import "../KDOTicket.sol";

pragma solidity ^0.4.4;


contract Factory {
    mapping(address => address[]) public created;

    constructor() public {
        createContract();
    }

    function createContract() public returns (address) {
        KDOTicket newToken = (new KDOTicket([30, 30, 30, 30, 30], 0x996863718d440A5e8263D5B5b9Dc93142091Fef1));
        created[msg.sender].push(address(newToken));

        return address(newToken);
    }
}
