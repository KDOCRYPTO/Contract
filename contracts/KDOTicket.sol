pragma solidity ^0.4.18;

import "./eip20/EIP20.sol";


contract KDOTicket is EIP20(0, "KDO coin", 0, "KDO") {

    mapping (string => uint256) private tickets;

    function KDOTicket() public {
        tickets["bronze"] = 99;
        tickets["silver"] = 149;
        tickets["gold"] = 249;
    }

    modifier onlyExistingTicket(string _ticketType) {
        require(tickets[_ticketType] > 0);
        _;
    }

    // Allocates a ticket to an address and create tokens (accordingly to the value of the allocated ticket)
    function allocateNewTicket(address _to, string _ticketType)
        public
        onlyContractOwner()
        onlyExistingTicket(_ticketType)
        returns (bool success)
    {
        uint256 _ticketValue = tickets[_ticketType];

        balances[_to] += _ticketValue;

        totalSupply += _ticketValue;

        return true;
    }

    // Checks if an address can handle the ticket type
    function isTicketValid(address _ticketAddr, string _ticketType)
        public
        onlyExistingTicket(_ticketType)
        view
        returns (bool success)
    {
        if (balances[_ticketAddr] >= tickets[_ticketType]) {
            return true;
        }
        return false;
    }


}
