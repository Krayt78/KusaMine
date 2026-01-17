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

  describe("buyToken()", function () {
    describe("Happy path", function () {
      it("Should mint a token when paying exactly the price", async function () {
        const { player, price, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(otherAccount).buyToken({ value: price });

        expect(await player.balanceOf(otherAccount.address)).to.equal(1);
      });

      it("Should set the buyer as owner of the minted token", async function () {
        const { player, price, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(otherAccount).buyToken({ value: price });

        expect(await player.ownerOf(1)).to.equal(otherAccount.address);
      });

      it("Should increment tokenIdCounter from 0 to 1 to 2", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

        expect(await player.getTokenIdCounter()).to.equal(0);

        await player.connect(owner).buyToken({ value: price });
        expect(await player.getTokenIdCounter()).to.equal(1);

        await player.connect(otherAccount).buyToken({ value: price });
        expect(await player.getTokenIdCounter()).to.equal(2);
      });

      it("Should set default attributes (10,10,10,10) for minted token", async function () {
        const { player, price, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(otherAccount).buyToken({ value: price });

        const attributes = await player.getAttributes(1);
        expect(attributes.strenght).to.equal(10);
        expect(attributes.dexterity).to.equal(10);
        expect(attributes.intelligence).to.equal(10);
        expect(attributes.luck).to.equal(10);
      });
    });

    describe("Overpayment", function () {
      it("Should mint when paying more than the price", async function () {
        const { player, price, otherAccount } = await loadFixture(deployPlayerFixture);
        const overpayment = price * 2n;

        await player.connect(otherAccount).buyToken({ value: overpayment });

        expect(await player.balanceOf(otherAccount.address)).to.equal(1);
      });

      it("Should increase contract ETH balance by msg.value (no refund)", async function () {
        const { player, price, otherAccount } = await loadFixture(deployPlayerFixture);
        const overpayment = price * 2n;

        const balanceBefore = await hre.ethers.provider.getBalance(await player.getAddress());
        await player.connect(otherAccount).buyToken({ value: overpayment });
        const balanceAfter = await hre.ethers.provider.getBalance(await player.getAddress());

        expect(balanceAfter - balanceBefore).to.equal(overpayment);
      });
    });

    describe("Failure cases", function () {
      it("Should revert when paying less than the price", async function () {
        const { player, price, otherAccount } = await loadFixture(deployPlayerFixture);
        const underpayment = price / 2n;

        await expect(
          player.connect(otherAccount).buyToken({ value: underpayment })
        ).to.be.revertedWith("Amount must be greater than or equal to the price");
      });

      it("Should revert when same wallet calls buyToken() twice", async function () {
        const { player, price, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(otherAccount).buyToken({ value: price });

        await expect(
          player.connect(otherAccount).buyToken({ value: price })
        ).to.be.revertedWith("Player already has a token");
      });
    });

    describe("Safe mint behavior", function () {
      it("Should revert when caller is a contract without IERC721Receiver", async function () {
        const { player, price } = await loadFixture(deployPlayerFixture);

        // Deploy a contract that does NOT implement IERC721Receiver
        const NonReceiverFactory = await hre.ethers.getContractFactory("NonERC721Receiver");
        const nonReceiver = await NonReceiverFactory.deploy();

        await expect(
          nonReceiver.callBuyToken(await player.getAddress(), { value: price })
        ).to.be.revertedWithCustomError(player, "ERC721InvalidReceiver");
      });

      it("Should succeed when caller is a contract that implements IERC721Receiver", async function () {
        const { player, price } = await loadFixture(deployPlayerFixture);

        // Deploy a contract that implements IERC721Receiver
        const ReceiverFactory = await hre.ethers.getContractFactory("ERC721ReceiverMock");
        const receiver = await ReceiverFactory.deploy();

        await receiver.callBuyToken(await player.getAddress(), { value: price });

        expect(await player.balanceOf(await receiver.getAddress())).to.equal(1);
      });
    });
  });
});
