const { expectThrow } = require('./utils');

const KDOTicket = artifacts.require('KDOTicket');
let HST, tickets, contractOwner;

contract('KDOTicket', (accounts) => {
  beforeEach(async () => {
    HST = await KDOTicket.new({ from: accounts[0] });
    tickets = {
      'bronze': 99,
      'silver': 149,
      'gold': 249
    };
    contractOwner = accounts[0];
  });

  it('creation: should create an initial balance of 10000 for the creator', async () => {
    const balance = await HST.balanceOf.call(accounts[0]);
    assert.strictEqual(balance.toNumber(), 0);
  });

  it('creation: test correct setting of vanity information', async () => {
    const name = await HST.name.call();
    assert.strictEqual(name, 'KDO coin');

    const decimals = await HST.decimals.call();
    assert.strictEqual(decimals.toNumber(), 0);

    const symbol = await HST.symbol.call();
    assert.strictEqual(symbol, 'KDO');
  });

  it('ticket: should transfer ticket value to accounts[1]', async () => {
    let tKey1 = 'gold';
    await HST.allocateNewTicket(accounts[1], tKey1, { from: contractOwner });

    const balance = await HST.balanceOf.call(accounts[1]);
    assert.strictEqual(balance.toNumber(), tickets[tKey1]);

    let tKey2 = 'silver';
    await HST.allocateNewTicket(accounts[1], tKey2, { from: contractOwner });

    const balanceCumulated = await HST.balanceOf.call(accounts[1]);
    let totValue = tickets[tKey1] + tickets[tKey2];
    assert.strictEqual(balanceCumulated.toNumber(), totValue);
  });

  it('ticket: should be elligible for inferior ticket but not superior ones', async () => {
    await HST.allocateNewTicket(accounts[1], 'silver', { from: contractOwner });

    const isBronze = await HST.isTicketValid.call(accounts[1], 'bronze');
    const isSilver = await HST.isTicketValid.call(accounts[1], 'silver');
    const isGold = await HST.isTicketValid.call(accounts[1], 'gold');

    assert.isTrue(isBronze, isSilver)
    assert.isFalse(isGold);
  });

  it('ticket: should accumulate ticket values to total supply', async () => {
    let tKey1 = 'silver';
    let tKey2 = 'gold';
    let tVal1 = tickets[tKey1];
    let tVal2 = tickets[tKey2];

    await HST.allocateNewTicket(accounts[1], tKey1, { from: contractOwner });
    const totalSupply1 = await HST.getTotalSupply.call();
    assert.strictEqual(totalSupply1.toNumber(), tVal1);

    await HST.allocateNewTicket(accounts[1], tKey2, { from: contractOwner });
    const totalSupply2 = await HST.getTotalSupply.call();
    assert.strictEqual(totalSupply2.toNumber(), tVal1 + tVal2);
  });

  it('ticket: should be consumed when transfer happens', async () => {
    await HST.allocateNewTicket(accounts[1], 'bronze', { from: contractOwner });

    const isBronze = await HST.isTicketValid.call(accounts[1], 'bronze');

    assert.isTrue(isBronze);

    await HST.transfer(accounts[2], tickets['bronze'], { from: accounts[1] });

    const isStillBronze = await HST.isTicketValid.call(accounts[1], 'bronze');

    assert.isFalse(isStillBronze);

    const receiverBalance = await HST.balanceOf.call(accounts[2]);

    assert.strictEqual(receiverBalance.toNumber(), tickets['bronze']);
  });

  it('ticket: should not be able to create tickets', async () => {
    await HST.allocateNewTicket(accounts[1], 'silver', { from: accounts[1] });
    const ticketBalance = await HST.balanceOf.call(accounts[1]);
    assert.strictEqual(ticketBalance.toNumber(), 0);
  });

  it('transfers: should fail when trying to transfer 1 to accounts[1] with accounts[0] having 0', () => {
    expectThrow(HST.transfer.call(accounts[1], 1, { from: accounts[0] }));
  });

  it('transfers: should handle zero-transfers normally', async () => {
    assert(await HST.transfer.call(accounts[1], 0, { from: accounts[0] }), 'zero-transfer has failed');
  });

  // NOTE: testing uint256 wrapping is impossible since you can't supply > 2^256 -1
  // todo: transfer max amounts

  // APPROVALS
  it('approvals: msg.sender should approve 100 to accounts[1]', async () => {
    await HST.allocateNewTicket(accounts[0], 'silver', { from: contractOwner });
    await HST.approve(accounts[1], 100, { from: accounts[0] });
    const allowance = await HST.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance.toNumber(), 100);
  });

  // should approve 100 of msg.sender & withdraw 50, twice. (should succeed)
  it('approvals: msg.sender approves accounts[1] of 100 & withdraws 20 twice.', async () => {
    let balance = tickets['silver'];

    await HST.allocateNewTicket(accounts[0], 'silver', { from: contractOwner });

    await HST.approve(accounts[1], 100, { from: accounts[0] });
    const allowance01 = await HST.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance01.toNumber(), 100);

    await HST.transferFrom(accounts[0], accounts[2], 20, { from: accounts[1] });
    const allowance012 = await HST.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance012.toNumber(), 80);

    const balance2 = await HST.balanceOf.call(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 20);

    const balance0 = await HST.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toNumber(), balance - 20);

    // FIRST tx done.
    // onto next.
    await HST.transferFrom(accounts[0], accounts[2], 20, { from: accounts[1] });
    const allowance013 = await HST.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance013.toNumber(), 60);

    const balance22 = await HST.balanceOf.call(accounts[2]);
    assert.strictEqual(balance22.toNumber(), 40);

    const balance02 = await HST.balanceOf.call(accounts[0]);
    assert.strictEqual(balance02.toNumber(), balance - 40);
  });
  //
  // should approve 100 of msg.sender & withdraw 50 & 60 (should fail).
  it('approvals: msg.sender approves accounts[1] of 100 & withdraws 50 & 60 (2nd tx should fail)', async () => {
    let balance = tickets['silver'];

    await HST.allocateNewTicket(accounts[0], 'silver', { from: contractOwner });

    await HST.approve(accounts[1], 100, { from: accounts[0] });
    const allowance01 = await HST.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance01.toNumber(), 100);

    await HST.transferFrom(accounts[0], accounts[2], 50, { from: accounts[1] });
    const allowance012 = await HST.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance012.toNumber(), 50);

    const balance2 = await HST.balanceOf.call(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 50);

    const balance0 = await HST.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toNumber(), balance - 50);

    // FIRST tx done.
    // onto next.
    expectThrow(HST.transferFrom.call(accounts[0], accounts[2], 60, { from: accounts[1] }));
  });

  it('approvals: attempt withdrawal from account with no allowance (should fail)', () => expectThrow(HST.transferFrom.call(accounts[0], accounts[2], 60, { from: accounts[1] })));

  it('approvals: allow accounts[1] 100 to withdraw from accounts[0]. Withdraw 60 and then approve 0 & attempt transfer.', async () => {
    await HST.allocateNewTicket(accounts[0], 'silver', { from: contractOwner });

    await HST.approve(accounts[1], 100, { from: accounts[0] });
    await HST.transferFrom(accounts[0], accounts[2], 60, { from: accounts[1] });
    await HST.approve(accounts[1], 0, { from: accounts[0] });
    expectThrow(HST.transferFrom.call(accounts[0], accounts[2], 10, { from: accounts[1] }));
  });

  /* eslint-disable no-underscore-dangle */
  it('events: should fire Transfer event properly', async () => {
    let balance = tickets['silver'];

    await HST.allocateNewTicket(accounts[0], 'silver', { from: contractOwner });

    const res = await HST.transfer(accounts[1], '100', { from: accounts[0] });
    const transferLog = res.logs.find(element => element.event.match('Transfer'));
    assert.strictEqual(transferLog.args._from, accounts[0]);
    assert.strictEqual(transferLog.args._to, accounts[1]);
    assert.strictEqual(transferLog.args._value.toString(), '100');
  });

  it('events: should fire Transfer event normally on a zero transfer', async () => {
    const res = await HST.transfer(accounts[1], '0', { from: accounts[0] });
    const transferLog = res.logs.find(element => element.event.match('Transfer'));
    assert.strictEqual(transferLog.args._from, accounts[0]);
    assert.strictEqual(transferLog.args._to, accounts[1]);
    assert.strictEqual(transferLog.args._value.toString(), '0');
  });

  it('events: should fire Approval event properly', async () => {
    let balance = tickets['silver'];

    await HST.allocateNewTicket(accounts[0], 'silver', { from: contractOwner });
    
    const res = await HST.approve(accounts[1], '100', { from: accounts[0] });
    const approvalLog = res.logs.find(element => element.event.match('Approval'));
    assert.strictEqual(approvalLog.args._owner, accounts[0]);
    assert.strictEqual(approvalLog.args._spender, accounts[1]);
    assert.strictEqual(approvalLog.args._value.toString(), '100');
  });
});
