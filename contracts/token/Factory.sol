import "../KDOTicket.sol";

pragma solidity ^0.4.18;


contract Factory {

    mapping(address => address[]) public created;

    function Factory() public {
        createContract();
    }

    function createContract() public returns (address) {
        KDOTicket newToken = (new KDOTicket());
        created[msg.sender].push(address(newToken));

        return address(newToken);
    }
}
