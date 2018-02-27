pragma solidity ^0.4.18;

import "./token/Token.sol";


contract KDOTicket is Token(0, "KDO coin", 0, "KDO") {

    struct Ticket {
        uint256 balance;
        string tType;
        uint createdAt;
        uint expireAt;
    }

    mapping (address => Ticket) public activeTickets;
    // A consumer is a person who can consume ticketTypes and be credited for
    mapping (address => uint256) public consumersBalance;
    mapping (address => bool) public allowedConsumers;

    event DebitEvt(address consumer, uint256 amount, uint256 date);
    event Consume(address ticket, address consumer, string tType, uint256 date);
    event Cancel(address ticket, uint256 date);

    mapping (uint256 => string) public ticketTypes;

    function KDOTicket() public {
        ticketTypes[99] = "bronze";
        ticketTypes[149] = "silver";
        ticketTypes[249] = "gold";
    }

    modifier onlyExistingTicket(uint256 _amount) {
        require(bytes(ticketTypes[_amount]).length > 0);
        _;
    }

    modifier onlyAllowedConsumer() {
        require(allowedConsumers[msg.sender]);
        _;
    }

    // Allocates a ticket to an address and create tokens (accordingly to the value of the allocated ticket)
    function allocateNewTicket(address _to, uint256 _amount)
        public
        onlyContractOwner()
        onlyExistingTicket(_amount)
        returns (bool success)
    {
        activeTickets[_to] = Ticket({
            balance: _amount,
            tType: ticketTypes[_amount],
            createdAt: now,
            expireAt: now + 2 years
        });

        totalSupply += _amount;
        circulatingSupply += _amount;

        return true;
    }

    // Nullify a ticket. Used in special case when a ticket hasn't been received
    function cancelTicket(address _to)
        public
        onlyContractOwner()
    {
        circulatingSupply -= activeTickets[_to].balance;
        totalSupply -= activeTickets[_to].balance;
        activeTickets[_to].balance = 0;
        activeTickets[_to].expireAt = now;

        Cancel(_to, now);
    }

    // Checks if an address can handle the ticket type
    function isTicketValid(address _ticketAddr)
        public
        view
        returns (bool valid)
    {
        if (activeTickets[_ticketAddr].balance > 0 && now < activeTickets[_ticketAddr].expireAt) {
            return true;
        }
        return false;
    }

    // Get ticket expiration date
    function ticketExpiration(address _ticket) public view returns (uint256 expiration) {
        return activeTickets[_ticket].expireAt;
    }

    // Consume a ticket. Sets it balance to 0
    // It triggers Consume event for logs
    function consumeTicket(address _ticketAddr)
        public
        onlyAllowedConsumer()
        returns (bool success)
    {
        if (!isTicketValid(_ticketAddr)) {
            return false;
        }

        uint256 value = activeTickets[_ticketAddr].balance;

        activeTickets[_ticketAddr].balance = 0;

        consumersBalance[msg.sender] += value;

        Consume(_ticketAddr, msg.sender, activeTickets[_ticketAddr].tType, now);

        return true;
    }

    // Returns the type of a ticket
    function infoOfTicket(address _address) public view returns (uint256, string, uint, uint) {
        return (activeTickets[_address].balance, activeTickets[_address].tType, activeTickets[_address].createdAt, activeTickets[_address].expireAt);
    }

    // Returns the balance of a consumer
    function balanceOfConsumer(address _address) public view returns (uint256 balance) {
        return consumersBalance[_address];
    }

    // Detroy tokens from consumer balance.
    // It triggers Credit event
    function debit() public {
        uint256 _balance = consumersBalance[msg.sender];

        circulatingSupply -= _balance;

        consumersBalance[msg.sender] = 0;

        DebitEvt(msg.sender, _balance, now);
    }

    // Adds multiple addresses to register them as Consumers
    function addAllowedConsumers(address[] _addresses) public onlyContractOwner() {
        for (uint i = 0; i < _addresses.length; i++) {
            allowedConsumers[_addresses[i]] = true;
        }
    }

    // Removes multiple addresses from consumers list
    function removeAllowedConsumers(address[] _addresses) public onlyContractOwner() {
        for (uint i = 0; i < _addresses.length; i++) {
            allowedConsumers[_addresses[i]] = false;
        }
    }
}
