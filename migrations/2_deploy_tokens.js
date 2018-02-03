const EIP20 = artifacts.require('./KDOTicket.sol');

module.exports = (deployer) => {
  deployer.deploy(EIP20);
};
