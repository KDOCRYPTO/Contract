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

    event Debit(address consumer, uint256 amount, uint256 date);
    event Consume(address ticket, address consumer, string tType, uint256 date);

    mapping (string => uint256) ticketTypes;

    function KDOTicket() public {
        ticketTypes["bronze"] = 99;
        ticketTypes["silver"] = 149;
        ticketTypes["gold"] = 249;
    }

    modifier onlyExistingTicket(string _ticketType) {
        require(ticketTypes[_ticketType] > 0);
        _;
    }

    modifier onlyAllowedConsumer() {
        require(allowedConsumers[msg.sender]);
        _;
    }

    // Allocates a ticket to an address and create tokens (accordingly to the value of the allocated ticket)
    function allocateNewTicket(address _to, string _ticketType)
        public
        onlyContractOwner()
        onlyExistingTicket(_ticketType)
        returns (bool success)
    {
        uint256 _ticketValue = ticketTypes[_ticketType];

        activeTickets[_to] = Ticket({
            balance: _ticketValue,
            tType: _ticketType,
            createdAt: now,
            expireAt: now * 2 years
        });

        totalSupply += _ticketValue;

        return true;
    }

    // Checks if an address can handle the ticket type
    function isTicketValid(address _ticketAddr, string _ticketType)
        public
        onlyExistingTicket(_ticketType)
        view
        returns (bool valid)
    {
        if (activeTickets[_ticketAddr].balance >= ticketTypes[_ticketType] && now < activeTickets[_ticketAddr].expireAt) {
            return true;
        }
        return false;
    }

    // Consume a ticket. A ticket can keep some balances so it's reusable.
    // It triggers Consume event for logs
    function consumeTicket(address _ticketAddr, string _ticketType)
        public
        onlyExistingTicket(_ticketType)
        onlyAllowedConsumer()
        returns (bool success)
    {
        if (!isTicketValid(_ticketAddr, _ticketType)) {
            return false;
        }

        uint256 value = ticketTypes[_ticketType];

        activeTickets[_ticketAddr].balance -= value;

        consumersBalance[msg.sender] += value;

        Consume(_ticketAddr, msg.sender, _ticketType, now);

        return true;
    }

    // Returns the balance of a ticket
    function balanceOfTicket(address _address) public view returns (uint256 balance) {
        return activeTickets[_address].balance;
    }

    // Returns the balance of a consumer
    function balanceOfConsumer(address _address) public view returns (uint256 balance) {
        return consumersBalance[_address];
    }

    // Detroy tokens from consumer balance.
    // It triggers Credit event
    function debit() public {
        uint256 _balance = consumersBalance[msg.sender];

        totalSupply -= _balance;

        consumersBalance[msg.sender] = 0;

        Debit(msg.sender, _balance, now);
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
