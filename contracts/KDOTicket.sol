pragma solidity ^0.4.4;

import "./token/Token.sol";


contract KDOTicket is Token(0, "KDO coin", 0, "KDO") {
    struct Ticket {
        uint256 balance;
        string tType;
        uint createdAt;
        uint expireAt;
        address contractor;
        bool hasReviewed;
    }

    struct Contractor {
        uint256 balance;
        mapping (uint => uint) reviews;

        uint256 debittedBalance;
    }

    // Commission regarding the review average, the index is about the rating value
    // the value is the commission in %
    uint8[5] public commissions;

    mapping (address => Ticket) public activeTickets;
    // A contractor is a person who can consume ticketTypes and be credited for
    mapping (address => Contractor) public contractors;

    event CreditEvt(address ticket, address contractor, string tType, uint256 date);
    event DebitEvt(address contractor, uint256 amount, uint256 commission, uint256 date);
    event CommissionsChangeEvt(uint8[5] commissions, uint256 date);

    mapping (uint256 => string) public ticketTypes;

    // 150000 Gwei
    uint256 constant public MIN_TICKET_BASE_VALUE = 150000000000000;

    uint256 public ticketBaseValue;

    constructor(uint8[5] _commissions) public {
        ticketBaseValue = MIN_TICKET_BASE_VALUE;
        commissions = _commissions;
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

    // Update the commissions
    function updateCommissions(uint8[5] _c) public
        onlyContractOwner()
    {
        commissions = _c;
        emit CommissionsChangeEvt(_c, now);
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
            expireAt: now + 2 * 365 days,
            contractor: 0x0,
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

    // A ticket credit the contractor balance. Sets its balance to 0 and adds the value to the contractor balance
    // It triggers Consume event for logs
    function creditContractor(address _consumer)
        public
        returns (bool success)
    {
        require(isTicketValid(msg.sender));

        uint256 value = activeTickets[msg.sender].balance;

        activeTickets[msg.sender].balance = 0;

        contractors[_consumer].balance += value;

        activeTickets[msg.sender].contractor = _consumer;

        emit CreditEvt(msg.sender, _consumer, activeTickets[msg.sender].tType, now);

        return true;
    }

    // Publish a review and rate the ticket's contractor (only consumed tickets can
    // perform this action)
    function publishReview(uint _reviewRate) public {
        // Only ticket that hasn't published any review and that has been consumed
        require(!activeTickets[msg.sender].hasReviewed && activeTickets[msg.sender].contractor != 0x0);

        // Only between 0 and 5
        require(_reviewRate >= 0 && _reviewRate <= 5);

        // Add the review to the contractor of the ticket
        contractors[activeTickets[msg.sender].contractor].reviews[_reviewRate] += 1;

        activeTickets[msg.sender].hasReviewed = true;
    }

    function reviewAverageOfContractor(address _address) public view returns (uint avg) {
        // Apply a penalty of -1 for reviews = 0
        int totReviews = int(contractors[_address].reviews[0]) * -1;

        uint nbReviews = contractors[_address].reviews[0];


        for (uint i = 1; i <= 5; i++) {
            totReviews += int(contractors[_address].reviews[i] * i);
            nbReviews += contractors[_address].reviews[i];
        }

        if (nbReviews == 0) {
            return 300;
        }

        // Too much penalties leads to 0, then force it to be 0, the average
        // can't be negative
        if (totReviews < 0) {
            totReviews = 0;
        }

        return (uint(totReviews) * 100) / nbReviews;
    }

    // Returns the commission for the contractor
    function commissionForContractor(address _address) public view returns (uint8 c) {
        return commissionForReviewAverageOf(reviewAverageOfContractor(_address));
    }

    // Returns the info of a ticket
    function infoOfTicket(address _address) public view returns (uint256 balance, string tType, bool isValid, uint createdAt, uint expireAt, address contractor, bool hasReviewed) {
        return (activeTickets[_address].balance, activeTickets[_address].tType, isTicketValid(_address), activeTickets[_address].createdAt, activeTickets[_address].expireAt, activeTickets[_address].contractor, activeTickets[_address].hasReviewed);
    }

    // Returns the type of a ticket regarding its amount
    function ticketType(uint256 _amount) public view returns (string _type) {
        return ticketTypes[_amount];
    }

    // Returns the contractor info
    function infoOfContractor(address _address) public view returns(uint256 balance, uint256 debittedBalance, uint256 nbReviews, uint256 avg) {
        for (uint i = 0; i <= 5; i++) {
            nbReviews += contractors[_address].reviews[i];
        }

        return (contractors[_address].balance, contractors[_address].debittedBalance, nbReviews, reviewAverageOfContractor(_address));
    }

    // Returns the balance of a contractor
    function balanceOfContractor(address _address) public view returns (uint256 balance) {
        return contractors[_address].balance;
    }

    // Detroy tokens from contractor balance.
    // It triggers Debit event
    function debit(uint256 _amount) public {
        // Safe math and nobody can debit more than her balance
        require(_amount <= contractors[msg.sender].balance && _amount <= circulatingSupply);

        circulatingSupply -= _amount;

        contractors[msg.sender].debittedBalance += contractors[msg.sender].balance;
        contractors[msg.sender].balance -= _amount;

        emit DebitEvt(msg.sender, _amount, commissionForContractor(msg.sender), now);
    }

    // Returns the cost of a ticket regarding its amount
    // Returned value is represented in Wei
    function costOfTicket(uint256 _amount) public view returns(uint256 cost) {
        return (_amount * (0.003 * 1000000000000000000)) + ticketBaseValue;
    }

    // Calculate the commission regarding the rating (review average)
    // Example with a commissions = [30, 30, 30, 25, 20]
    // [0,3[ = 30% (DefaultCommission)
    // [3,4[ = 25%
    // [4,5[ = 20%
    // A rating average of 3.8 = 25% of commission
    function commissionForReviewAverageOf(uint _avg) public view returns (uint8 c) {
        if (_avg >= 500) {
            return commissions[4];
        }

        for (uint i = 0; i < 5; i++) {
            if (_avg <= i * 100 || _avg < (i + 1) * 100) {
                return commissions[i];
            }
        }

        // Default commission when there is something wrong
        return commissions[0];
    }
}
