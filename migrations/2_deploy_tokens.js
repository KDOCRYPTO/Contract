const KDO = artifacts.require('./KDOTicket.sol');

module.exports = (deployer) => {
  deployer.deploy(KDO, { value: 10000000000000000 });
};
