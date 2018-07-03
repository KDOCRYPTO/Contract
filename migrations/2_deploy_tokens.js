const KDO = artifacts.require('./KDOTicket.sol');

module.exports = (deployer) => {
  deployer.deploy(KDO, [30, 30, 30, 30, 30]);
};
