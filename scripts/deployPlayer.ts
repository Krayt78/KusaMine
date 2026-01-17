import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying Player contract with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "PAS");

  const price = ethers.parseEther("1"); // 1 PAS
  console.log("Player mint price:", ethers.formatEther(price), "PAS");

  const Player = await ethers.getContractFactory("Player");
  console.log("Deploying...");

  const player = await Player.deploy(price);
  await player.waitForDeployment();

  const address = await player.getAddress();
  console.log("Player contract deployed to:", address);
  console.log("View on explorer: https://blockscout-passet-hub.parity-testnet.parity.io/address/" + address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
