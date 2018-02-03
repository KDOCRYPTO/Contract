const EIP20Factory = artifacts.require('EIP20Factory');

contract('EIP20Factory', (accounts) => {
  it('Verify a Human Standard Token once deployed using both verification functions.', async () => {
    const factory = await EIP20Factory.new();
    const newTokenAddr = await factory.createEIP20.call({ from: accounts[0] });
    await factory.createEIP20({ from: accounts[0] });
    const res = await factory.verifyEIP20.call(newTokenAddr, { from: accounts[0] });
    assert(res, 'Could not verify the token.');
  });
});
