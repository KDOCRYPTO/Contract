const { expectThrow } = require('./utils');

const KDOTicket = artifacts.require('KDOTicket');

let HST;
let contractOwner;
let businessOwner;

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

const commissions = [1, 2, 3, 4, 5];

contract('KDOTicket', (accounts) => {
  beforeEach(async () => {
    contractOwner = accounts[0];
    businessOwner = accounts[1];
    HST = await KDOTicket.new(commissions, businessOwner, { from: contractOwner });

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

  it('ticket: should transfer ether value to business owner when allocating', async () => {
    const ticketKey = 'bronze';

    const businessOwnerBeforeAllocating = web3.eth.getBalance(businessOwner);
    const value = tickets[ticketKey].value;

    await HST.allocateNewTicket(accounts[3], tickets[ticketKey].amount, { from: accounts[2], value });

    const businessOwnerAfterAllocating = web3.eth.getBalance(businessOwner);

    assert.strictEqual(businessOwnerAfterAllocating.toNumber(), businessOwnerBeforeAllocating.toNumber() + (tickets[ticketKey].value - baseTicketWeiValue));
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

    const contractor = accounts[2];
    await HST.creditContractor(contractor, { from: ticket });

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
    const contractor = accounts[2];
    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    await HST.creditContractor(contractor, { from: ticket });

    await HST.publishReview(0, { from: ticket });
  });

  it('ticket: should not be able to vote for contractor if not consumed', async () => {
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    expectThrow(HST.publishReview(5, { from: ticket }));
  });

  it('ticket: should return the type "bronze" when ticket amount is 99', async () => {
    const ticketType = await HST.ticketTypes(tickets.bronze.amount);

    assert.strictEqual(ticketType, 'bronze');
  });

  it('ticket events: should fire Review when ticket reviews a contractor', async () => {
    const ticket = accounts[1];
    const contractor = accounts[2];
    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    await HST.creditContractor(contractor, { from: ticket });

    const rate = 1;

    const res = await HST.publishReview(1, { from: ticket });

    const reviewLog = res.logs.find(element => element.event.match('ReviewEvt'));

    assert.strictEqual(reviewLog.args.reviewer, ticket);
    assert.strictEqual(reviewLog.args.contractor, contractor);
    assert.strictEqual(reviewLog.args.rate.toNumber(), rate);
  });

  it('ticket events: should fire Consume when a ticket has been consumed', async () => {
    const ticket = accounts[1];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, tickets[ticketKey].amount, { from: contractOwner, value: tickets[ticketKey].value });

    const contractor = accounts[2];

    const res = await HST.creditContractor(contractor, { from: ticket });

    const creditLog = res.logs.find(element => element.event.match('CreditEvt'));

    assert.strictEqual(creditLog.args.ticket, ticket);
    assert.strictEqual(creditLog.args.contractor, contractor);
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

  it('contractor: should destroy contractor balance when debiting', async () => {
    const ticket = accounts[1];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, tickets[ticketKey].amount, { from: contractOwner, value: tickets[ticketKey].value });

    const contractor = accounts[2];

    await HST.creditContractor(contractor, { from: ticket });

    const balanceBeforeDebit = await HST.balanceOfContractor.call(contractor);

    assert.strictEqual(balanceBeforeDebit.toNumber(), tickets[ticketKey].amount);

    const totalSupplyBeforeDebit = await HST.getTotalSupply.call();

    assert.strictEqual(totalSupplyBeforeDebit.toNumber(), tickets[ticketKey].amount);

    await HST.debit(tickets[ticketKey].amount, { from: contractor });

    const balanceAfterDebit = await HST.balanceOfContractor.call(contractor);

    assert.strictEqual(balanceAfterDebit.toNumber(), 0);

    const circulatingSupplyAfterDebit = await HST.circulatingSupply.call();

    assert.strictEqual(circulatingSupplyAfterDebit.toNumber(), 0); // Debit detroys coins
  });

  it('contractor: should not be able to debit more than the balance', () => {
    expectThrow(HST.debit(1000));
  });

  it('contractor: should have a correct average when receiving reviews', async () => {
    const ticket1 = accounts[1];
    const ticket2 = accounts[2];
    const ticket3 = accounts[3];
    const contractor = accounts[4];

    await HST.allocateNewTicket(ticket1, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });
    await HST.allocateNewTicket(ticket2, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });
    await HST.allocateNewTicket(ticket3, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    await HST.creditContractor(contractor, { from: ticket1 });
    await HST.creditContractor(contractor, { from: ticket2 });
    await HST.creditContractor(contractor, { from: ticket3 });

    // Review of 0 means -1 (its a penalty)
    await HST.publishReview(0, { from: ticket1 });

    await HST.publishReview(3, { from: ticket2 });
    await HST.publishReview(5, { from: ticket3 });

    const avg = await HST.reviewAverageOfContractor(contractor);

    const expectedAvg = ((3 + 5) - 1) / 3;

    assert.strictEqual(avg.toNumber(), Math.trunc(expectedAvg * 100));
  });

  it('contractor: should have a avg of 0 when it only has reviews of 0', async () => {
    const ticket = accounts[1];
    const contractor = accounts[2];

    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    await HST.creditContractor(contractor, { from: ticket });

    await HST.publishReview(0, { from: ticket });

    const avg = await HST.reviewAverageOfContractor(contractor);

    const expectedAverage = 0;

    assert.strictEqual(avg.toNumber(), expectedAverage);
  });

  it('contractor: should have an avg of 4.5 (450) when 1 review of 5 and 1 missing review (that means 50% of review)', async () => {
    const ticket = accounts[1];
    const contractor = accounts[2];

    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });
    await HST.creditContractor(contractor, { from: ticket });

    // First review
    await HST.publishReview(5, { from: ticket });

    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });
    await HST.creditContractor(contractor, { from: ticket });

    // No review for this ticket

    const avgReview = await HST.reviewAverageOfContractor(contractor);

    assert.strictEqual(avgReview.toNumber(), 450);
  });

  it('contractor event: should fire Debit event when a contractor has been debitted', async () => {
    const contractor = accounts[3];

    const res = await HST.debit(0, { from: contractor });

    const debitLog = res.logs.find(element => element.event.match('DebitEvt'));

    const contractorCommission = await HST.commissionForContractor(contractor);

    assert.strictEqual(debitLog.args.contractor, contractor);
    assert.strictEqual(debitLog.args.commission.toNumber(), contractorCommission.toNumber());
    assert.strictEqual(debitLog.args.amount.toNumber(), 0);
  });

  it('commissions: should not be able to update the commissions when not contract owner', () => {
    expectThrow(HST.updateCommissions([0, 0, 0, 0, 0], { from: accounts[2] }));
  });

  it('commissions: should returns the expected commission for all rating', async () => {
    const com0 = await HST.commissionForReviewAverageOf(0);
    const com1 = await HST.commissionForReviewAverageOf(20);
    const com2 = await HST.commissionForReviewAverageOf(120);
    const com3 = await HST.commissionForReviewAverageOf(222);
    const com4 = await HST.commissionForReviewAverageOf(320);
    const com5 = await HST.commissionForReviewAverageOf(400);
    const com6 = await HST.commissionForReviewAverageOf(5100);

    assert.strictEqual(com0.toNumber(), commissions[0]);
    assert.strictEqual(com1.toNumber(), commissions[0]);
    assert.strictEqual(com2.toNumber(), commissions[1]);
    assert.strictEqual(com3.toNumber(), commissions[2]);
    assert.strictEqual(com4.toNumber(), commissions[3]);
    assert.strictEqual(com5.toNumber(), commissions[4]);
    assert.strictEqual(com6.toNumber(), commissions[4]);
  });

  it('commissions: should return the expected commissions of 2 when contractor is rated 1.5', async () => {
    const ticket = accounts[1];
    const contractor = accounts[2];

    // the contractor get rated by 1 and 2 which is averaged by 1.5
    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    await HST.creditContractor(contractor, { from: ticket });

    await HST.publishReview(1, { from: ticket });

    await HST.allocateNewTicket(ticket, tickets.silver.amount, { from: contractOwner, value: tickets.silver.value });

    await HST.creditContractor(contractor, { from: ticket });

    await HST.publishReview(2, { from: ticket });

    const contractorCommission = await HST.commissionForContractor(contractor);

    assert.strictEqual(contractorCommission.toNumber(), 2);
  });

  it('commissions events: should trigger an event when the commissions are updated', async () => {
    const newCommissions = [0, 0, 0, 0, 0];

    const res = await HST.updateCommissions(newCommissions, { from: contractOwner });

    const comChangeLog = res.logs.find(element => element.event.match('CommissionsChangeEvt'));

    assert.strictEqual(comChangeLog.args.commissions[0].toNumber(), newCommissions[0]);
    assert.strictEqual(comChangeLog.args.commissions[1].toNumber(), newCommissions[1]);
    assert.strictEqual(comChangeLog.args.commissions[2].toNumber(), newCommissions[2]);
    assert.strictEqual(comChangeLog.args.commissions[3].toNumber(), newCommissions[3]);
    assert.strictEqual(comChangeLog.args.commissions[4].toNumber(), newCommissions[4]);
  });
});
