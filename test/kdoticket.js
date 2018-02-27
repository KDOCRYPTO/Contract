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
    await HST.allocateNewTicket(accounts[1], tickets.bronze, { from: contractOwner });

    const ticket = await HST.infoOfTicket.call(accounts[1]);
    assert.strictEqual(ticket[0].toNumber(), tickets.bronze);
  });

  it('ticket: should be valid after creation', async () => {
    await HST.allocateNewTicket(accounts[1], tickets.silver, { from: contractOwner });

    const isValid = await HST.isTicketValid.call(accounts[1]);

    assert.isTrue(isValid);
  });

  it('ticket: should fail when trying to allocate non-existing ticket value', () => {
    expectThrow(HST.allocateNewTicket.call(accounts[1], 20, { from: contractOwner }));
  });

  it('ticket: should not be consumable by a non consumer', async () => {
    const tKey = 'silver';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, tickets[tKey], { from: contractOwner });

    const notAConsumer = accounts[2];

    expectThrow(HST.consumeTicket.call(ticket, { from: notAConsumer }));

    const addedAndRemovedConsumer = accounts[3];
    await HST.addAllowedConsumers([addedAndRemovedConsumer], { from: contractOwner });
    await HST.removeAllowedConsumers([addedAndRemovedConsumer], { from: contractOwner });

    expectThrow(HST.consumeTicket.call(ticket, { from: addedAndRemovedConsumer }));
  });

  it('ticket: should be consumed when an allowed consumer consumes it', async () => {
    const ticketKey = 'silver';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, tickets[ticketKey], { from: contractOwner });

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });

    await HST.consumeTicket(ticket, { from: consumer });

    const ticketInfo = await HST.infoOfTicket.call(ticket);
    assert.strictEqual(ticketInfo[0].toNumber(), 0);
    const consBalance = await HST.balanceOfConsumer.call(consumer);
    assert.strictEqual(consBalance.toNumber(), tickets[ticketKey]);
  });

  it('ticket: should not be valid when no value', async () => {
    const ticketKey = 'silver';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, tickets[ticketKey], { from: contractOwner });

    const isValid = await HST.isTicketValid(ticket);
    assert.isTrue(isValid);

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });
    await HST.consumeTicket(ticket, { from: consumer });

    const isValidAfterBeingConsumed = await HST.isTicketValid(ticket);
    assert.isFalse(isValidAfterBeingConsumed);
  });

  it('ticket: should not be valid when expired', async () => {
    const ticketKey = 'silver';
    const ticket = accounts[1];
    await HST.allocateNewTicket(ticket, tickets[ticketKey], { from: contractOwner });

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

  it('ticket: should not be able to create tickets', async () => {
    await HST.allocateNewTicket(accounts[1], tickets.silver, { from: accounts[1] });
    const ticket = await HST.infoOfTicket.call(accounts[1]);
    assert.strictEqual(ticket[0].toNumber(), 0);
  });

  it('ticket: should be invalid when cancelled', async () => {
    await HST.allocateNewTicket(accounts[1], tickets.silver, { from: contractOwner });

    const isValid = await HST.isTicketValid.call(accounts[1]);

    assert.isTrue(isValid);

    await HST.cancelTicket(accounts[1], { from: contractOwner });

    const isValidAfterCancel = await HST.isTicketValid.call(accounts[1]);

    assert.isFalse(isValidAfterCancel);
  });

  it('ticket: only contract owner can cancel a ticket', () => {
    expectThrow(HST.cancelTicket.call(accounts[1], { from: accounts[3] }));
  });

  it('ticket events: should fire Consume when a ticket has been consumed', async () => {
    const ticket = accounts[1];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, tickets[ticketKey], { from: contractOwner });

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });

    const res = await HST.consumeTicket(ticket, { from: consumer });

    const consumeLog = res.logs.find(element => element.event.match('Consume'));

    assert.strictEqual(consumeLog.args.ticket, ticket);
    assert.strictEqual(consumeLog.args.consumer, consumer);
    assert.strictEqual(consumeLog.args.tType, ticketKey);
  });

  it('ticket events: should fire Cancel when a ticket has been cancelled', async () => {
    const ticket = accounts[1];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, tickets[ticketKey], { from: contractOwner });

    const res = await HST.cancelTicket(ticket, { from: contractOwner });

    const cancelLog = res.logs.find(element => element.event.match('Cancel'));

    assert.strictEqual(cancelLog.args.ticket, ticket);
  });

  it('consumer: should destroy consumer balance when debiting', async () => {
    const ticket = accounts[0];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, tickets[ticketKey], { from: contractOwner });

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });

    await HST.consumeTicket(ticket, { from: consumer });

    const balanceBeforeDebit = await HST.balanceOfConsumer.call(consumer);

    assert.strictEqual(balanceBeforeDebit.toNumber(), tickets[ticketKey]);

    const totalSupplyBeforeDebit = await HST.getTotalSupply.call();

    assert.strictEqual(totalSupplyBeforeDebit.toNumber(), tickets[ticketKey]);

    await HST.debit({ from: consumer });

    const balanceAfterDebit = await HST.balanceOfConsumer.call(consumer);

    assert.strictEqual(balanceAfterDebit.toNumber(), 0);

    const circulatingSupplyAfterDebit = await HST.circulatingSupply.call();

    assert.strictEqual(circulatingSupplyAfterDebit.toNumber(), 0); // Debit detroys coins
  });

  it('consumer event: should fire Debit event when a consumer has been debitted', async () => {
    const ticket = accounts[0];
    const ticketKey = 'silver';
    await HST.allocateNewTicket(ticket, tickets[ticketKey], { from: contractOwner });

    const consumer = accounts[2];
    await HST.addAllowedConsumers([consumer], { from: contractOwner });

    await HST.consumeTicket(ticket, { from: consumer });

    const balanceBeforeDebit = await HST.balanceOfConsumer.call(consumer);

    const res = await HST.debit({ from: consumer });

    const debitLog = res.logs.find(element => element.event.match('DebitEvt'));

    assert.strictEqual(debitLog.args.consumer, consumer);
    assert.strictEqual(debitLog.args.amount.toNumber(), balanceBeforeDebit.toNumber());
  });
});
