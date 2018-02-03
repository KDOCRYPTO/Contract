module.exports = {
  expectThrow: async (promise) => {
    const errMsg = 'Expected throw not received';
    try {
      await promise;
    } catch (err) {
      assert(err.toString(), errMsg);
      return;
    }
    assert.fail(errMsg);
  },
};
