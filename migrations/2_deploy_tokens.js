const KDO = artifacts.require('./KDOTicket.sol');

module.exports = (deployer) => {
  deployer.deploy(KDO, [30, 30, 30, 30, 30], '0x996863718d440A5e8263D5B5b9Dc93142091Fef1');
};
