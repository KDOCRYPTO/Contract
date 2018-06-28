import "../KDOTicket.sol";

pragma solidity ^0.4.4;


contract Factory {
    mapping(address => address[]) public created;

    constructor() public {
        createContract();
    }

    function createContract() public returns (address) {
        KDOTicket newToken = (new KDOTicket());
        created[msg.sender].push(address(newToken));

        return address(newToken);
    }
}
