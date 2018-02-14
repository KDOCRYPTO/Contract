const { expectThrow } = require('./utils');

const KDOTicket = artifacts.require('KDOTicket');

let HST;
let contractOwner;

const tickets = {
  bronze: 99,
  silver: 149,
  gold: 249,
};

contract('KDOTicket', (accounts) => {
  beforeEach(async () => {
    HST = await KDOTicket.new({ from: accounts[0] });
    contractOwner = accounts[0];
  });

  it('creation: test correct setting of vanity information', async () => {
    const name = await HST.name.call();
    assert.strictEqual(name, 'KDO coin');

    const decimals = await HST.decimals.call();
    assert.strictEqual(decimals.toNumber(), 0);

    const symbol = await HST.symbol.call();
    assert.strictEqual(symbol, 'KDO');
  });

  it('consumer: should not be able to add or remove a consumer', () => {
    expectThrow(HST.addAllowedConsumers.call(accounts, { from: accounts[2] }));
    expectThrow(HST.removeAllowedConsumers.call(accounts, { from: accounts[2] }));
  });

  it('ticket: should not be able to allocate new ticket (not contract owner)', () => {
    expectThrow(HST.allocateNewTicket.call(accounts[1], 'gold', { from: accounts[2] }));
  });

  it('ticket: should transfer ticket value to accounts[1]', async () => {
    const tKey1 = 'gold';
    await HST.allocateNewTicket(accounts[1], tKey1, { from: contractOwner });

    const balance = await HST.balanceOfTicket.call(accounts[1]);
    assert.strictEqual(balance.toNumber(), tickets[tKey1]);
  });

  it('ticket: should be elligible for inferior ticket but not superior ones', async () => {
    await HST.allocateNewTicket(accounts[1], 'silver', { from: contractOwner });

    const isBronze = await HST.isTicketValid.call(accounts[1], 'bronze');
    const isSilver = await HST.isTicketValid.call(accounts[1], 'silver');
    const isGold = await HST.isTicketValid.call(accounts[1], 'gold');

    assert.isTrue(isBronze, isSilver);
    assert.isFalse(isGold);
  });

  it('ticket: should fail when trying to allocate non-existing ticket type', () => {
    expectThrow(HST.allocateNewTicket.call(accounts[1], 'foobar', { from: contractOwner }));
  });

  it('ticket: should not be consumable by a non consumer', async () => {
    const tKey = 'silver';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, tKey, { from: contractOwner });

    const notAConsumer = accounts[2];

    expectThrow(HST.consumeTicket.call(ticket, 'silver', { from: notAConsumer }));

    const addedAndRemovedConsumer = accounts[3];
    await HST.addAllowedConsumers([addedAndRemovedConsumer], { from: contractOwner });
    await HST.removeAllowedConsumers([addedAndRemovedConsumer], { from: contractOwner });

    expectThrow(HST.consumeTicket.call(ticket, 'silver', { from: addedAndRemovedConsumer }));
  });

  it('ticket: should be consumed when an allowed consumer consumes it', async () => {
    const ticketKey = 'silver';
    const ticketConsKey = 'bronze';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, ticketKey, { from: contractOwner });

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });

    await HST.consumeTicket(ticket, ticketConsKey, { from: consumer });

    const ticketBalance = await HST.balanceOfTicket.call(ticket);
    assert.strictEqual(ticketBalance.toNumber(), tickets[ticketKey] - tickets[ticketConsKey]);
    const consBalance = await HST.balanceOfConsumer.call(consumer);
    assert.strictEqual(consBalance.toNumber(), tickets[ticketConsKey]);
  });

  it('ticket: should not be valid when no value', async () => {
    const ticketKey = 'silver';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, ticketKey, { from: contractOwner });

    const isValid = await HST.isTicketValid(ticket, ticketKey);
    assert.isTrue(isValid);

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });
    await HST.consumeTicket(ticket, ticketKey, { from: consumer });

    const isValidAfterBeingConsumed = await HST.isTicketValid(ticket, ticketKey);
    assert.isFalse(isValidAfterBeingConsumed);
  });

  it('ticket: should not be valid when expired', async () => {
    const ticketKey = 'silver';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, ticketKey, { from: contractOwner });

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

    const isTicketValid = await HST.isTicketValid.call(ticket, ticketKey);
    assert.isFalse(isTicketValid);
  });

  it('ticket: should not be able to create tickets', async () => {
    await HST.allocateNewTicket(accounts[1], 'silver', { from: accounts[1] });
    const ticketBalance = await HST.balanceOfTicket.call(accounts[1]);
    assert.strictEqual(ticketBalance.toNumber(), 0);
  });

  it('ticket events: should fire Consume when a ticket has been consumed', async () => {
    const ticket = accounts[0];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, ticketKey, { from: contractOwner });

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });

    const res = await HST.consumeTicket(ticket, ticketKey, { from: consumer });

    const consumeLog = res.logs.find(element => element.event.match('Consume'));

    assert.strictEqual(consumeLog.args.ticket, ticket);
    assert.strictEqual(consumeLog.args.consumer, consumer);
    assert.strictEqual(consumeLog.args.tType, ticketKey);
  });

  it('consumer: should destroy consumer balance when debiting', async () => {
    const ticket = accounts[0];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, ticketKey, { from: contractOwner });

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });

    await HST.consumeTicket(ticket, ticketKey, { from: consumer });

    const balanceBeforeDebit = await HST.balanceOfConsumer.call(consumer);

    assert.strictEqual(balanceBeforeDebit.toNumber(), tickets[ticketKey]);

    const totalSupplyBeforeDebit = await HST.getTotalSupply.call();

    assert.strictEqual(totalSupplyBeforeDebit.toNumber(), tickets[ticketKey]);

    await HST.debit({ from: consumer });

    const balanceAfterDebit = await HST.balanceOfConsumer.call(consumer);

    assert.strictEqual(balanceAfterDebit.toNumber(), 0);

    const totalSupplyAfterDebit = await HST.getTotalSupply.call();

    assert.strictEqual(totalSupplyAfterDebit.toNumber(), 0); // Debit detroys coins
  });

  it('consumer event: should fire Debit event when a consumer has been debitted', async () => {
    const ticket = accounts[0];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, ticketKey, { from: contractOwner });

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });

    await HST.consumeTicket(ticket, ticketKey, { from: consumer });

    const balanceBeforeDebit = await HST.balanceOfConsumer.call(consumer);

    const res = await HST.debit({ from: consumer });

    const debitLog = res.logs.find(element => element.event.match('Debit'));

    assert.strictEqual(debitLog.args.consumer, consumer);
    assert.strictEqual(debitLog.args.amount.toNumber(), balanceBeforeDebit.toNumber());
  });
});
