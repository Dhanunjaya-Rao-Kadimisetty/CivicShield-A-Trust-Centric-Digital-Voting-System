require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545",
      accounts: [
        "0x39bb1e5d1d1227c91b02f7ac5bfb651fd32cac31c075bd31724aaa146e2ff90f"
      ]
    }
  }
};
