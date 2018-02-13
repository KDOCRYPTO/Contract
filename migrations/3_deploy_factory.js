const Factory =
  artifacts.require('./Factory.sol');

module.exports = (deployer) => {
  deployer.deploy(Factory);
};
