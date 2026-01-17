import { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@parity/hardhat-polkadot";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  resolc: {
    compilerSource: "npm",
  },
  networks: {
    paseoAssetHub: {
      polkavm: true,
      url: "https://testnet-passet-hub-eth-rpc.polkadot.io",
      chainId: 420420422,
      accounts: [vars.get("PRIVATE_KEY")],
    },
  },
  sourcify: {
  enabled: true
  },
  etherscan: {
    apiKey: {
      paseoAssetHub: vars.get("SUBSCAN_API_KEY")
    },
    customChains: [
      {
        network: "paseoAssetHub",
        chainId: 420420422,
        urls: {
          apiURL: "https://passet-hub.api.subscan.io/api/scan/evm/contract/verifysource",
          browserURL: "https://passet-hub.subscan.io"
        }
      }
    ]
  }
};

export default config;
