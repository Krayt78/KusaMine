import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Player", function () {
  async function deployPlayerFixture() {
    const price = hre.ethers.parseEther("0.1");
    const upgradeTokenAddress = hre.ethers.ZeroAddress;

    const [owner, otherAccount] = await hre.ethers.getSigners();

    const Player = await hre.ethers.getContractFactory("Player");
    const player = await Player.deploy(price, upgradeTokenAddress);

    return { player, price, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right price", async function () {
      const { player, price } = await loadFixture(deployPlayerFixture);

      expect(await player.getPrice()).to.equal(price);
    });

    it("Should set the right owner", async function () {
      const { player, owner } = await loadFixture(deployPlayerFixture);

      expect(await player.owner()).to.equal(owner.address);
    });

    it("Should have zero tokens minted initially", async function () {
      const { player } = await loadFixture(deployPlayerFixture);

      expect(await player.getTokenIdCounter()).to.equal(0);
    });
  });
});
