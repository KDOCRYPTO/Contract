const { expectThrow } = require('./utils');

const KDOTicket = artifacts.require('KDOTicket');

let HST;
let contractOwner;

const tickets = {
  bronze: {
    amount: 99,
    value: 0,
  },
  silver: {
    amount: 149,
    value: 0,
  },
  gold: {
    amount: 349,
    value: 0,
  },
};

const baseTicketWeiValue = 150000000000000;
const zeroBalanceAddress = '0x59141cA21c745CB67B51c51Ae1F5Ec11AdbDC064';

contract('KDOTicket', (accounts) => {
  beforeEach(async () => {
    contractOwner = accounts[0];
    HST = await KDOTicket.new({ from: contractOwner });

    await HST.addTicketType(tickets.bronze.amount, Object.keys(tickets)[0]);
    await HST.addTicketType(tickets.silver.amount, Object.keys(tickets)[1]);
    await HST.addTicketType(tickets.gold.amount, Object.keys(tickets)[2]);

    const bronzeValue = await HST.costOfTicket(tickets.bronze.amount);
    tickets.bronze.value = bronzeValue.toNumber();

    const silverValue = await HST.costOfTicket(tickets.silver.amount);
    tickets.silver.value = silverValue.toNumber();

    const goldValue = await HST.costOfTicket(tickets.gold.amount);
    tickets.gold.value = goldValue.toNumber();
  });

  it('creation: test correct setting of vanity information', async () => {
    const name = await HST.name.call();
    assert.strictEqual(name, 'KDO coin');

    const decimals = await HST.decimals.call();
    assert.strictEqual(decimals.toNumber(), 0);

    const symbol = await HST.symbol.call();
    assert.strictEqual(symbol, 'KDO');
  });

  it('ticket: should not be able to allocate new ticket if not enough value', () => {
    expectThrow(HST.allocateNewTicket.call(accounts[1], tickets.bronze, { from: accounts[2], value: 1 }));
  });

  it('ticket: should transfer ticket amount to accounts[1]', async () => {
    await HST.allocateNewTicket(accounts[1], tickets.bronze.amount, { from: contractOwner, value: tickets.bronze.value });

    const ticket = await HST.infoOfTicket.call(accounts[1]);
    assert.strictEqual(ticket[0].toNumber(), tickets.bronze.amount);
  });

  it('ticket: should transfer ether value to contract owner when allocating', async () => {
    const ticketKey = 'bronze';

    const ownerBalanceBeforeAllocating = web3.eth.getBalance(contractOwner);
    const value = tickets[ticketKey].value;

    await HST.allocateNewTicket(accounts[3], tickets[ticketKey].amount, { from: accounts[2], value });

    const ownerBalanceAfterAllocating = web3.eth.getBalance(contractOwner);

    assert.strictEqual(ownerBalanceAfterAllocating.toNumber(), ownerBalanceBeforeAllocating.toNumber() + (tickets[ticketKey].value - baseTicketWeiValue));
  });

  it('ticket: should be valid after creation', async () => {
    await HST.allocateNewTicket(zeroBalanceAddress, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    const isValid = await HST.isTicketValid.call(zeroBalanceAddress);

    assert.isTrue(isValid);
  });

  it('ticket: should fail when trying to allocate non-existing ticket value', () => {
    expectThrow(HST.allocateNewTicket.call(accounts[1], 20, { from: contractOwner }));
  });

  it('ticket: should have assigned GAS of const baseTicketWeiValue', async () => {
    const ticket = accounts[9];

    const balanceBeforeAllocation = await web3.eth.getBalance(ticket);

    await HST.allocateNewTicket(ticket, tickets.bronze.amount, { from: contractOwner, value: tickets.bronze.value });

    const balanceAfterAllocation = await web3.eth.getBalance(ticket);

    assert.strictEqual(balanceAfterAllocation.toNumber(), baseTicketWeiValue + balanceBeforeAllocation.toNumber());
  });

  it('ticket: should not be valid when no value', async () => {
    const ticketKey = 'silver';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, tickets[ticketKey].amount, { from: contractOwner, value: tickets[ticketKey].value });

    const isValid = await HST.isTicketValid(ticket);
    assert.isTrue(isValid);

    const consumer = accounts[2];
    await HST.creditConsumer(consumer, { from: ticket });

    const isValidAfterBeingConsumed = await HST.isTicketValid(ticket);
    assert.isFalse(isValidAfterBeingConsumed);
  });

  it('ticket: should not be valid when expired', async () => {
    const ticketKey = 'silver';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, tickets[ticketKey].amount, { from: contractOwner, value: tickets[ticketKey].value });

    // add up +2years
    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [60 * 60 * 24 * 365 * 2],
      id: 0,
    });

    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: 1,
    });

    const isTicketValid = await HST.isTicketValid.call(ticket);
    assert.isFalse(isTicketValid);
  });

  it('ticket: should not be able to create tickets when not good value', () => {
    expectThrow(HST.allocateNewTicket(accounts[1], tickets.silver, { from: accounts[1], value: baseTicketWeiValue }));
  });

  it('ticket: should be able to publish a review', async () => {
    const ticket = accounts[1];
    const consumer = accounts[2];
    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    await HST.creditConsumer(consumer, { from: ticket });

    await HST.publishReview(0, { from: ticket });
  });

  it('ticket: should not be able to vote for consumer if not consumed', async () => {
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    expectThrow(HST.publishReview(5, { from: ticket }));
  });

  it('ticket events: should fire Consume when a ticket has been consumed', async () => {
    const ticket = accounts[1];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, tickets[ticketKey].amount, { from: contractOwner, value: tickets[ticketKey].value });

    const consumer = accounts[2];

    const res = await HST.creditConsumer(consumer, { from: ticket });

    const creditLog = res.logs.find(element => element.event.match('CreditEvt'));

    assert.strictEqual(creditLog.args.ticket, ticket);
    assert.strictEqual(creditLog.args.consumer, consumer);
    assert.strictEqual(creditLog.args.tType, ticketKey);
  });

  it('ticket gas value: should update ticket gas value', async () => {
    await HST.updateTicketBaseValue(baseTicketWeiValue + 1, { from: contractOwner });
    const ticketBaseValue = await HST.ticketBaseValue.call();
    assert.strictEqual(ticketBaseValue.toNumber(), baseTicketWeiValue + 1);
  });

  it('ticket gas value: should fail when the sender is not the contract owner', () => {
    expectThrow(HST.updateTicketBaseValue(baseTicketWeiValue + 1, { from: accounts[5] }));
  });

  it('ticket gas value: should fail when the new value is less than the minimal acceptable value (1200000000000000)', () => {
    expectThrow(HST.updateTicketBaseValue(baseTicketWeiValue - 1, { from: contractOwner }));
  });

  it('consumer: should destroy consumer balance when debiting', async () => {
    const ticket = accounts[1];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, tickets[ticketKey].amount, { from: contractOwner, value: tickets[ticketKey].value });

    const consumer = accounts[2];

    await HST.creditConsumer(consumer, { from: ticket });

    const balanceBeforeDebit = await HST.balanceOfConsumer.call(consumer);

    assert.strictEqual(balanceBeforeDebit.toNumber(), tickets[ticketKey].amount);

    const totalSupplyBeforeDebit = await HST.getTotalSupply.call();

    assert.strictEqual(totalSupplyBeforeDebit.toNumber(), tickets[ticketKey].amount);

    await HST.debit(tickets[ticketKey].amount, { from: consumer });

    const balanceAfterDebit = await HST.balanceOfConsumer.call(consumer);

    assert.strictEqual(balanceAfterDebit.toNumber(), 0);

    const circulatingSupplyAfterDebit = await HST.circulatingSupply.call();

    assert.strictEqual(circulatingSupplyAfterDebit.toNumber(), 0); // Debit detroys coins
  });

  it('consumer: should not be able to debit more than the balance', () => {
    expectThrow(HST.debit(1000));
  });

  it('consumer: should have a correct median when receiving reviews', async () => {
    const ticket1 = accounts[1];
    const ticket2 = accounts[2];
    const ticket3 = accounts[3];
    const consumer = accounts[4];

    await HST.allocateNewTicket(ticket1, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });
    await HST.allocateNewTicket(ticket2, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });
    await HST.allocateNewTicket(ticket3, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    await HST.creditConsumer(consumer, { from: ticket1 });
    await HST.creditConsumer(consumer, { from: ticket2 });
    await HST.creditConsumer(consumer, { from: ticket3 });

    // Review of 0 means -1 (its a penalty)
    await HST.publishReview(0, { from: ticket1 });

    await HST.publishReview(3, { from: ticket2 });
    await HST.publishReview(5, { from: ticket3 });

    const median = await HST.reviewMedianOfConsumer(consumer);

    const expectedMedian = ((3 + 5) - 1) / 3;

    assert.strictEqual(median.toNumber(), Math.trunc(expectedMedian * 100));
  });

  it('consumer: should have a median of 0 when it only has reviews of 0', async () => {
    const ticket = accounts[1];
    const consumer = accounts[2];

    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    await HST.creditConsumer(consumer, { from: ticket });

    await HST.publishReview(0, { from: ticket });

    const median = await HST.reviewMedianOfConsumer(consumer);

    const expectedMedian = 0;

    assert.strictEqual(median.toNumber(), expectedMedian);
  });

  it('consumer event: should fire Debit event when a consumer has been debitted', async () => {
    const consumer = accounts[3];

    const res = await HST.debit(0, { from: consumer });

    const debitLog = res.logs.find(element => element.event.match('DebitEvt'));

    assert.strictEqual(debitLog.args.consumer, consumer);
    assert.strictEqual(debitLog.args.amount.toNumber(), 0);
  });
});
