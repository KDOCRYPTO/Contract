pragma solidity ^0.4.18;

import "./token/Token.sol";


contract KDOTicket is Token(0, "KDO coin", 0, "KDO") {

    struct Ticket {
        uint256 balance;
        string tType;
        uint createdAt;
        uint expireAt;
        address consumer;
        bool hasReviewed;
    }

    struct Consumer {
        uint256 balance;
        mapping (uint => uint) reviews;

        uint256 cumulatedBalance;
    }

    mapping (address => Ticket) public activeTickets;
    // A consumer is a person who can consume ticketTypes and be credited for
    mapping (address => Consumer) public consumers;

    event CreditEvt(address ticket, address consumer, string tType, uint256 date);
    event DebitEvt(address consumer, uint256 amount, uint256 date);

    mapping (uint256 => string) public ticketTypes;

    uint256 constant public MIN_TICKET_BASE_VALUE = 1200000000000000;
    uint256 public ticketBaseValue;

    function KDOTicket() public {
        // 120 Gwei
        ticketBaseValue = MIN_TICKET_BASE_VALUE;
    }

    // Only listed tickets
    modifier onlyExistingTicket(uint256 _amount) {
        require(bytes(ticketTypes[_amount]).length > 0);
        _;
    }

    // Update the ticket base value
    // a ticket value is the amount of ether allowed to the ticket in order to
    // be used
    function updateTicketBaseValue(uint256 _value) public
        onlyContractOwner()
    {
        // Cant put a value below the minimal value
        require(_value >= MIN_TICKET_BASE_VALUE);
        ticketBaseValue = _value;
    }

    // Add a new ticket type
    // Can update an old ticket type, for instance :
    // ticketTypes[99] = "bronze"
    // addTicketType(99, "wood")
    // ticketTypes[99] = "wood"
    // ticket 99 has been updated from "bronze" to "wood"
    function addTicketType(uint256 _amount, string _key) public
        onlyContractOwner()
    {
        ticketTypes[_amount] = _key;
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
            expireAt: now + 2 years,
            consumer: 0x0,
            hasReviewed: false
        });

        // Give minimal WEI value to a ticket
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
        if (activeTickets[_ticketAddr].balance > 0 && now < activeTickets[_ticketAddr].expireAt) {
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

        consumers[_consumer].balance += value;

        activeTickets[msg.sender].consumer = _consumer;

        CreditEvt(msg.sender, _consumer, activeTickets[msg.sender].tType, now);

        return true;
    }

    // Publish a review and rate the ticket's consumer (only consumed tickets can
    // perform this action)
    function publishReview(uint _reviewRate) public {
        // Only ticket that hasn't published any review and that has been consumed
        require(!activeTickets[msg.sender].hasReviewed && activeTickets[msg.sender].consumer != 0x0);

        // Only between 0 and 5
        require(_reviewRate >= 0 && _reviewRate <= 5);

        // Add the review to the consumer of the ticket
        consumers[activeTickets[msg.sender].consumer].reviews[_reviewRate] += 1;

        activeTickets[msg.sender].hasReviewed = true;
    }

    function reviewMedianOfConsumer(address _address) public view returns (uint median) {
        // Apply a penalty of -1 for reviews = 0
        int totReviews = int(consumers[_address].reviews[0]) * -1;
        uint nbReviews = consumers[_address].reviews[0];

        for (uint i = 1; i <= 5; i++) {
            totReviews += int(consumers[_address].reviews[i] * i);
            nbReviews += consumers[_address].reviews[i];
        }

        // Too much penalties leads to 0, then force it to be 0, the median
        // can't be negative
        if (totReviews < 0) {
            totReviews = 0;
        }

        return (uint(totReviews) * 100) / nbReviews;
    }

    // Returns the type of a ticket
    function infoOfTicket(address _address) public view returns (uint256 balance, string tType, bool isValid, uint createdAt, uint expireAt, address consumer, bool hasReviewed) {
        return (activeTickets[_address].balance, activeTickets[_address].tType, isTicketValid(_address), activeTickets[_address].createdAt, activeTickets[_address].expireAt, activeTickets[_address].consumer, activeTickets[_address].hasReviewed);
    }

    // Returns the consumer info
    function infoOfConsumer(address _address) public view returns(uint256 balance, uint256 cumulatedBalance, uint256 nbReviews, uint256 medianReview) {
        for (uint i = 0; i <= 5; i++) {
            nbReviews += consumers[_address].reviews[i];
        }

        return (consumers[_address].balance, consumers[_address].cumulatedBalance, nbReviews, reviewMedianOfConsumer(_address));
    }

    // Returns the balance of a consumer
    function balanceOfConsumer(address _address) public view returns (uint256 balance) {
        return consumers[_address].balance;
    }

    // Detroy tokens from consumer balance.
    // It triggers Debit event
    function debit(uint256 _amount) public {
        // Safe math and nobody can debit more than her balance
        require(_amount <= consumers[msg.sender].balance && _amount <= circulatingSupply);

        circulatingSupply -= _amount;

        consumers[msg.sender].cumulatedBalance += consumers[msg.sender].balance;
        consumers[msg.sender].balance -= _amount;

        DebitEvt(msg.sender, _amount, now);
    }

    // Returns the cost of a ticket regarding its amount
    // Returned value is represented in Wei
    function costOfTicket(uint256 _amount) public view returns(uint256 cost) {
        return (_amount * (0.003 * 1000000000000000000)) + ticketBaseValue;
    }
}
