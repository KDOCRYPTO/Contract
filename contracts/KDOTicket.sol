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

    event CreditEvt(address ticket, address consumer, string tType, uint256 date);
    event DebitEvt(address consumer, uint256 amount, uint256 date);

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

    // Allocates a ticket to an address and create tokens (accordingly to the value of the allocated ticket)
    function allocateNewTicket(address _to, uint256 _amount)
        public
        payable
        onlyExistingTicket(_amount)
        returns (bool success)
    {
        uint256 costInWei = costOfTicket(_amount); // costs 0.3% of the amount (represented in wei, so its indeed 0.3% of ether value)
        require(msg.value == 60000 + costInWei);

        activeTickets[_to] = Ticket({
            balance: _amount,
            tType: ticketTypes[_amount],
            createdAt: now,
            expireAt: now + 2 years
        });

        // Give minimal GAS value to a ticket
        _to.transfer(60000);

        // Price of the ticket
        owner.transfer(costInWei);

        totalSupply += _amount;
        circulatingSupply += _amount;

        return true;
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

    // A ticket credit the consumer balance. Sets its balance to 0 and adds the value to the consumer balance
    // It triggers Consume event for logs
    function creditConsumer(address _consumer)
        public
        payable
        returns (bool success)
    {
        require(isTicketValid(msg.sender));

        uint256 value = activeTickets[msg.sender].balance;

        // Transfer ticket balance to owner as owner allocate some value when allocating
        // the ticket
        owner.transfer(msg.value);

        activeTickets[msg.sender].balance = 0;

        consumersBalance[_consumer] += value;

        CreditEvt(msg.sender, _consumer, activeTickets[msg.sender].tType, now);

        return true;
    }

    // Returns the type of a ticket
    function infoOfTicket(address _address) public view returns (uint256, string, bool, uint, uint) {
        bool isValid = isTicketValid(_address);
        return (activeTickets[_address].balance, activeTickets[_address].tType, isValid, activeTickets[_address].createdAt, activeTickets[_address].expireAt);
    }

    // Returns the balance of a consumer
    function balanceOfConsumer(address _address) public view returns (uint256 balance) {
        return consumersBalance[_address];
    }

    // Detroy tokens from consumer balance.
    // It triggers Debit event
    function debitConsumer() public {
        uint256 _balance = consumersBalance[msg.sender];

        circulatingSupply -= _balance;

        consumersBalance[msg.sender] = 0;

        DebitEvt(msg.sender, _balance, now);
    }

    // Returns the cost of a ticket regarding its amount
    // Returned value is represented in Wei
    function costOfTicket(uint256 _amount) public pure returns(uint256 cost) {
        return _amount * (0.003 * 1000000000000000000);
    }
}
