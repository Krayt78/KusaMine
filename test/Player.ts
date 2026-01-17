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

  describe("Deployment + Initialization", function () {
    it("Should set name correctly to 'KusaMine Player'", async function () {
      const { player } = await loadFixture(deployPlayerFixture);

      expect(await player.name()).to.equal("KusaMine Player");
    });

    it("Should set symbol correctly to 'KMPLAYER'", async function () {
      const { player } = await loadFixture(deployPlayerFixture);

      expect(await player.symbol()).to.equal("KMPLAYER");
    });

    it("Should set the owner to the deployer", async function () {
      const { player, owner } = await loadFixture(deployPlayerFixture);

      expect(await player.owner()).to.equal(owner.address);
    });

    it("Should set the initial price to the constructor price", async function () {
      const { player, price } = await loadFixture(deployPlayerFixture);

      expect(await player.getPrice()).to.equal(price);
    });

    it("Should set the initial upgrade token to the constructor upgradeToken", async function () {
      const { player } = await loadFixture(deployPlayerFixture);

      expect(await player.getUpgradeToken()).to.equal(hre.ethers.ZeroAddress);
    });

    it("Should have initial upgrade cost equal to 0", async function () {
      const { player } = await loadFixture(deployPlayerFixture);

      expect(await player.getUpgradeCost()).to.equal(0);
    });

    it("Should have zero tokens minted initially", async function () {
      const { player } = await loadFixture(deployPlayerFixture);

      expect(await player.getTokenIdCounter()).to.equal(0);
    });
  });
});
