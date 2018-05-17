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

    event CreditEvt(address ticket, address consumer, string tType, uint256 date);
    event DebitEvt(address consumer, uint256 amount, uint256 date);

    mapping (uint256 => string) public ticketTypes;

    uint256 constant public MIN_TICKET_BASE_VALUE = 1200000000000000;
    uint256 public ticketBaseValue;

    function KDOTicket() public {
        ticketTypes[99] = "bronze";
        ticketTypes[149] = "silver";
        ticketTypes[249] = "gold";

        // 120 Gwei
        ticketBaseValue = MIN_TICKET_BASE_VALUE;
    }

    modifier onlyExistingTicket(uint256 _amount) {
        require(bytes(ticketTypes[_amount]).length > 0);
        _;
    }

    function updateTicketBaseValue(uint256 _value) public
        onlyContractOwner()
    {
        // Cant put a value below the minimal value
        require(_value >= MIN_TICKET_BASE_VALUE);
        ticketBaseValue = _value;
    }

    // Allocates a ticket to an address and create tokens (accordingly to the value of the allocated ticket)
    function allocateNewTicket(address _to, uint256 _amount)
        public
        payable
        onlyExistingTicket(_amount)
        returns (bool success)
    {
        uint256 costInWei = costOfTicket(_amount); // costs 0.3% of the amount (represented in wei, so its indeed 0.3% of ether value)
        require(msg.value == costInWei);

        activeTickets[_to] = Ticket({
            balance: _amount,
            tType: ticketTypes[_amount],
            createdAt: now,
            expireAt: now + 2 years
        });

        // Give minimal GAS value to a ticket
        _to.transfer(ticketBaseValue);

        // Price of the ticket
        owner.transfer(costInWei - ticketBaseValue);

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
        if (activeTickets[_ticketAddr].balance > 0 && _ticketAddr.balance >= MIN_TICKET_BASE_VALUE && now < activeTickets[_ticketAddr].expireAt) {
            return true;
        }
        return false;
    }

    // A ticket credit the consumer balance. Sets its balance to 0 and adds the value to the consumer balance
    // It triggers Consume event for logs
    function creditConsumer(address _consumer)
        public
        returns (bool success)
    {
        require(isTicketValid(msg.sender));

        uint256 value = activeTickets[msg.sender].balance;

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
    function debit(uint256 _amount) public {
        // Safe math and nobody can debit more than her balance
        require(_amount <= consumersBalance[msg.sender] && _amount <= circulatingSupply);

        circulatingSupply -= _amount;

        consumersBalance[msg.sender] -= _amount;

        DebitEvt(msg.sender, _amount, now);
    }

    // Returns the cost of a ticket regarding its amount
    // Returned value is represented in Wei
    function costOfTicket(uint256 _amount) public view returns(uint256 cost) {
        return (_amount * (0.003 * 1000000000000000000)) + ticketBaseValue;
    }
}
