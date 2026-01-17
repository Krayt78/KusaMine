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

  describe("Soulbound enforcement", function () {
    describe("Transfer blocking", function () {
      it("Should revert transferFrom with PlayerIsSoulbound", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(owner).buyToken({ value: price });

        await expect(
          player.connect(owner).transferFrom(owner.address, otherAccount.address, 1)
        ).to.be.revertedWithCustomError(player, "PlayerIsSoulbound");
      });

      it("Should revert safeTransferFrom with PlayerIsSoulbound", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(owner).buyToken({ value: price });

        await expect(
          player.connect(owner)["safeTransferFrom(address,address,uint256)"](
            owner.address,
            otherAccount.address,
            1
          )
        ).to.be.revertedWithCustomError(player, "PlayerIsSoulbound");
      });

      it("Should revert safeTransferFrom with data with PlayerIsSoulbound", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(owner).buyToken({ value: price });

        await expect(
          player.connect(owner)["safeTransferFrom(address,address,uint256,bytes)"](
            owner.address,
            otherAccount.address,
            1,
            "0x"
          )
        ).to.be.revertedWithCustomError(player, "PlayerIsSoulbound");
      });
    });

    describe("Approvals", function () {
      it("Should allow approve() to succeed", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(owner).buyToken({ value: price });

        await player.connect(owner).approve(otherAccount.address, 1);

        expect(await player.getApproved(1)).to.equal(otherAccount.address);
      });

      it("Should allow setApprovalForAll() to succeed", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(owner).buyToken({ value: price });

        await player.connect(owner).setApprovalForAll(otherAccount.address, true);

        expect(await player.isApprovedForAll(owner.address, otherAccount.address)).to.be.true;
      });

      it("Should still revert transfer even when approved", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(owner).buyToken({ value: price });
        await player.connect(owner).approve(otherAccount.address, 1);

        await expect(
          player.connect(otherAccount).transferFrom(owner.address, otherAccount.address, 1)
        ).to.be.revertedWithCustomError(player, "PlayerIsSoulbound");
      });

      it("Should still revert transfer even when approved for all", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

        await player.connect(owner).buyToken({ value: price });
        await player.connect(owner).setApprovalForAll(otherAccount.address, true);

        await expect(
          player.connect(otherAccount).transferFrom(owner.address, otherAccount.address, 1)
        ).to.be.revertedWithCustomError(player, "PlayerIsSoulbound");
      });
    });
  });

  describe("View functions", function () {
    it("getPrice() should return the current price", async function () {
      const { player, price } = await loadFixture(deployPlayerFixture);

      expect(await player.getPrice()).to.equal(price);
    });

    it("getTokenIdCounter() should return the minted count", async function () {
      const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

      expect(await player.getTokenIdCounter()).to.equal(0);

      await player.connect(owner).buyToken({ value: price });
      expect(await player.getTokenIdCounter()).to.equal(1);

      await player.connect(otherAccount).buyToken({ value: price });
      expect(await player.getTokenIdCounter()).to.equal(2);
    });

    it("getAttributes() should revert with 'Token does not exist' for non-existent token", async function () {
      const { player } = await loadFixture(deployPlayerFixture);

      await expect(player.getAttributes(999)).to.be.revertedWith("Token does not exist");
    });

    it("getAttributes() should return attributes for existing token", async function () {
      const { player, price, owner } = await loadFixture(deployPlayerFixture);

      await player.connect(owner).buyToken({ value: price });

      const attributes = await player.getAttributes(1);
      expect(attributes.strenght).to.equal(10);
      expect(attributes.dexterity).to.equal(10);
      expect(attributes.intelligence).to.equal(10);
      expect(attributes.luck).to.equal(10);
    });
  });

  describe("Owner-only admin setters", function () {
    describe("updatePrice()", function () {
      it("Should allow owner to update price", async function () {
        const { player, owner } = await loadFixture(deployPlayerFixture);
        const newPrice = hre.ethers.parseEther("0.5");

        await player.connect(owner).updatePrice(newPrice);

        expect(await player.getPrice()).to.equal(newPrice);
      });

      it("Should revert when non-owner calls updatePrice", async function () {
        const { player, otherAccount } = await loadFixture(deployPlayerFixture);
        const newPrice = hre.ethers.parseEther("0.5");

        await expect(
          player.connect(otherAccount).updatePrice(newPrice)
        ).to.be.revertedWithCustomError(player, "OwnableUnauthorizedAccount")
          .withArgs(otherAccount.address);
      });
    });

    describe("setUpgradeToken()", function () {
      it("Should allow owner to set upgrade token", async function () {
        const { player, owner, otherAccount } = await loadFixture(deployPlayerFixture);
        const newTokenAddress = otherAccount.address; // Using as a dummy address

        await player.connect(owner).setUpgradeToken(newTokenAddress);

        expect(await player.getUpgradeToken()).to.equal(newTokenAddress);
      });

      it("Should revert when non-owner calls setUpgradeToken", async function () {
        const { player, otherAccount } = await loadFixture(deployPlayerFixture);
        const newTokenAddress = otherAccount.address;

        await expect(
          player.connect(otherAccount).setUpgradeToken(newTokenAddress)
        ).to.be.revertedWithCustomError(player, "OwnableUnauthorizedAccount")
          .withArgs(otherAccount.address);
      });
    });

    describe("setUpgradeCost()", function () {
      it("Should allow owner to set upgrade cost", async function () {
        const { player, owner } = await loadFixture(deployPlayerFixture);
        const newCost = hre.ethers.parseEther("100");

        await player.connect(owner).setUpgradeCost(newCost);

        expect(await player.getUpgradeCost()).to.equal(newCost);
      });

      it("Should revert when non-owner calls setUpgradeCost", async function () {
        const { player, otherAccount } = await loadFixture(deployPlayerFixture);
        const newCost = hre.ethers.parseEther("100");

        await expect(
          player.connect(otherAccount).setUpgradeCost(newCost)
        ).to.be.revertedWithCustomError(player, "OwnableUnauthorizedAccount")
          .withArgs(otherAccount.address);
      });
    });

    describe("Sanity checks after updates", function () {
      it("Should reflect all changes after multiple updates", async function () {
        const { player, owner, otherAccount } = await loadFixture(deployPlayerFixture);
        const newPrice = hre.ethers.parseEther("0.25");
        const newTokenAddress = otherAccount.address;
        const newCost = hre.ethers.parseEther("50");

        await player.connect(owner).updatePrice(newPrice);
        await player.connect(owner).setUpgradeToken(newTokenAddress);
        await player.connect(owner).setUpgradeCost(newCost);

        expect(await player.getPrice()).to.equal(newPrice);
        expect(await player.getUpgradeToken()).to.equal(newTokenAddress);
        expect(await player.getUpgradeCost()).to.equal(newCost);
      });
    });
  });

  describe("upgradeAttribute()", function () {
    // Enum values matching the contract
    const Attribute = {
      Strength: 0,
      Dexterity: 1,
      Intelligence: 2,
      Luck: 3,
    };

    async function deployWithUpgradeSetupFixture() {
      const price = hre.ethers.parseEther("0.1");
      const upgradeCost = hre.ethers.parseEther("100");

      const [owner, otherAccount] = await hre.ethers.getSigners();

      // Deploy MockERC20
      const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
      const upgradeToken = await MockERC20Factory.deploy("Upgrade Token", "UPG");

      // Deploy Player with zero address initially
      const Player = await hre.ethers.getContractFactory("Player");
      const player = await Player.deploy(price, hre.ethers.ZeroAddress);

      // Setup upgrade token and cost
      await player.connect(owner).setUpgradeToken(await upgradeToken.getAddress());
      await player.connect(owner).setUpgradeCost(upgradeCost);

      // Mint player token for otherAccount
      await player.connect(otherAccount).buyToken({ value: price });

      // Mint upgrade tokens to otherAccount and approve
      await upgradeToken.mint(otherAccount.address, upgradeCost * 10n);
      await upgradeToken.connect(otherAccount).approve(await player.getAddress(), upgradeCost * 10n);

      return { player, upgradeToken, upgradeCost, price, owner, otherAccount };
    }

    describe("Happy path", function () {
      it("Should decrease caller's ERC20 balance by upgradeCost", async function () {
        const { player, upgradeToken, upgradeCost, otherAccount } = await loadFixture(deployWithUpgradeSetupFixture);

        const balanceBefore = await upgradeToken.balanceOf(otherAccount.address);
        await player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength);
        const balanceAfter = await upgradeToken.balanceOf(otherAccount.address);

        expect(balanceBefore - balanceAfter).to.equal(upgradeCost);
      });

      it("Should increase contract's ERC20 balance by upgradeCost", async function () {
        const { player, upgradeToken, upgradeCost, otherAccount } = await loadFixture(deployWithUpgradeSetupFixture);

        const balanceBefore = await upgradeToken.balanceOf(await player.getAddress());
        await player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength);
        const balanceAfter = await upgradeToken.balanceOf(await player.getAddress());

        expect(balanceAfter - balanceBefore).to.equal(upgradeCost);
      });

      it("Should increment only the chosen stat by 1", async function () {
        const { player, otherAccount } = await loadFixture(deployWithUpgradeSetupFixture);

        const attrsBefore = await player.getAttributes(1);
        await player.connect(otherAccount).upgradeAttribute(1, Attribute.Dexterity);
        const attrsAfter = await player.getAttributes(1);

        // Dexterity should increase by 1
        expect(attrsAfter.dexterity).to.equal(attrsBefore.dexterity + 1n);
        // Other stats unchanged
        expect(attrsAfter.strenght).to.equal(attrsBefore.strenght);
        expect(attrsAfter.intelligence).to.equal(attrsBefore.intelligence);
        expect(attrsAfter.luck).to.equal(attrsBefore.luck);
      });
    });

    describe("Each attribute branch", function () {
      it("Should increment strenght when Strength attribute is chosen", async function () {
        const { player, otherAccount } = await loadFixture(deployWithUpgradeSetupFixture);

        const attrsBefore = await player.getAttributes(1);
        await player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength);
        const attrsAfter = await player.getAttributes(1);

        expect(attrsAfter.strenght).to.equal(attrsBefore.strenght + 1n);
        expect(attrsAfter.dexterity).to.equal(attrsBefore.dexterity);
        expect(attrsAfter.intelligence).to.equal(attrsBefore.intelligence);
        expect(attrsAfter.luck).to.equal(attrsBefore.luck);
      });

      it("Should increment dexterity when Dexterity attribute is chosen", async function () {
        const { player, otherAccount } = await loadFixture(deployWithUpgradeSetupFixture);

        const attrsBefore = await player.getAttributes(1);
        await player.connect(otherAccount).upgradeAttribute(1, Attribute.Dexterity);
        const attrsAfter = await player.getAttributes(1);

        expect(attrsAfter.strenght).to.equal(attrsBefore.strenght);
        expect(attrsAfter.dexterity).to.equal(attrsBefore.dexterity + 1n);
        expect(attrsAfter.intelligence).to.equal(attrsBefore.intelligence);
        expect(attrsAfter.luck).to.equal(attrsBefore.luck);
      });

      it("Should increment intelligence when Intelligence attribute is chosen", async function () {
        const { player, otherAccount } = await loadFixture(deployWithUpgradeSetupFixture);

        const attrsBefore = await player.getAttributes(1);
        await player.connect(otherAccount).upgradeAttribute(1, Attribute.Intelligence);
        const attrsAfter = await player.getAttributes(1);

        expect(attrsAfter.strenght).to.equal(attrsBefore.strenght);
        expect(attrsAfter.dexterity).to.equal(attrsBefore.dexterity);
        expect(attrsAfter.intelligence).to.equal(attrsBefore.intelligence + 1n);
        expect(attrsAfter.luck).to.equal(attrsBefore.luck);
      });

      it("Should increment luck when Luck attribute is chosen", async function () {
        const { player, otherAccount } = await loadFixture(deployWithUpgradeSetupFixture);

        const attrsBefore = await player.getAttributes(1);
        await player.connect(otherAccount).upgradeAttribute(1, Attribute.Luck);
        const attrsAfter = await player.getAttributes(1);

        expect(attrsAfter.strenght).to.equal(attrsBefore.strenght);
        expect(attrsAfter.dexterity).to.equal(attrsBefore.dexterity);
        expect(attrsAfter.intelligence).to.equal(attrsBefore.intelligence);
        expect(attrsAfter.luck).to.equal(attrsBefore.luck + 1n);
      });
    });

    describe("Revert cases", function () {
      it("Should revert when caller is not the token owner", async function () {
        const { player, owner } = await loadFixture(deployWithUpgradeSetupFixture);

        // owner does not own token 1 (otherAccount does)
        await expect(
          player.connect(owner).upgradeAttribute(1, Attribute.Strength)
        ).to.be.revertedWith("Not the token owner");
      });

      it("Should revert when upgrade token is zero address", async function () {
        const { player, price, otherAccount } = await loadFixture(deployPlayerFixture);

        // Buy token but don't set upgrade token
        await player.connect(otherAccount).buyToken({ value: price });

        await expect(
          player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength)
        ).to.be.revertedWith("Upgrade token not set");
      });

      it("Should revert when upgrade cost is 0", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);

        // Deploy and set upgrade token but not cost
        const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
        const upgradeToken = await MockERC20Factory.deploy("Upgrade Token", "UPG");
        await player.connect(owner).setUpgradeToken(await upgradeToken.getAddress());

        await player.connect(otherAccount).buyToken({ value: price });

        await expect(
          player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength)
        ).to.be.revertedWith("Upgrade cost not set");
      });

      it("Should revert when caller has insufficient balance", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);
        const upgradeCost = hre.ethers.parseEther("100");

        // Setup upgrade token and cost
        const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
        const upgradeToken = await MockERC20Factory.deploy("Upgrade Token", "UPG");
        await player.connect(owner).setUpgradeToken(await upgradeToken.getAddress());
        await player.connect(owner).setUpgradeCost(upgradeCost);

        await player.connect(otherAccount).buyToken({ value: price });

        // Don't mint any tokens, just approve
        await upgradeToken.connect(otherAccount).approve(await player.getAddress(), upgradeCost);

        await expect(
          player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength)
        ).to.be.reverted; // ERC20 will revert with insufficient balance
      });

      it("Should revert when caller has insufficient allowance", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);
        const upgradeCost = hre.ethers.parseEther("100");

        // Setup upgrade token and cost
        const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
        const upgradeToken = await MockERC20Factory.deploy("Upgrade Token", "UPG");
        await player.connect(owner).setUpgradeToken(await upgradeToken.getAddress());
        await player.connect(owner).setUpgradeCost(upgradeCost);

        await player.connect(otherAccount).buyToken({ value: price });

        // Mint tokens but don't approve
        await upgradeToken.mint(otherAccount.address, upgradeCost);

        await expect(
          player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength)
        ).to.be.reverted; // ERC20 will revert with insufficient allowance
      });

      it("Should revert with 'Token transfer failed' when ERC20 returns false", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);
        const upgradeCost = hre.ethers.parseEther("100");

        // Deploy MockERC20ReturnsFalse
        const MockERC20ReturnsFalseFactory = await hre.ethers.getContractFactory("MockERC20ReturnsFalse");
        const falseToken = await MockERC20ReturnsFalseFactory.deploy();

        await player.connect(owner).setUpgradeToken(await falseToken.getAddress());
        await player.connect(owner).setUpgradeCost(upgradeCost);

        await player.connect(otherAccount).buyToken({ value: price });

        // Mint and approve
        await falseToken.mint(otherAccount.address, upgradeCost);
        await falseToken.connect(otherAccount).approve(await player.getAddress(), upgradeCost);

        await expect(
          player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength)
        ).to.be.revertedWith("Token transfer failed");
      });
    });

    describe("State integrity on revert", function () {
      it("Should not change attributes when revert occurs", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);
        const upgradeCost = hre.ethers.parseEther("100");

        // Setup with false-returning ERC20
        const MockERC20ReturnsFalseFactory = await hre.ethers.getContractFactory("MockERC20ReturnsFalse");
        const falseToken = await MockERC20ReturnsFalseFactory.deploy();

        await player.connect(owner).setUpgradeToken(await falseToken.getAddress());
        await player.connect(owner).setUpgradeCost(upgradeCost);

        await player.connect(otherAccount).buyToken({ value: price });
        await falseToken.mint(otherAccount.address, upgradeCost);
        await falseToken.connect(otherAccount).approve(await player.getAddress(), upgradeCost);

        const attrsBefore = await player.getAttributes(1);

        // Attempt upgrade (will revert)
        await expect(
          player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength)
        ).to.be.revertedWith("Token transfer failed");

        // Verify attributes unchanged
        const attrsAfter = await player.getAttributes(1);
        expect(attrsAfter.strenght).to.equal(attrsBefore.strenght);
        expect(attrsAfter.dexterity).to.equal(attrsBefore.dexterity);
        expect(attrsAfter.intelligence).to.equal(attrsBefore.intelligence);
        expect(attrsAfter.luck).to.equal(attrsBefore.luck);
      });
    });

    describe("Reentrancy protection", function () {
      it("Should not allow double upgrade via reentrancy", async function () {
        const { player, price, owner, otherAccount } = await loadFixture(deployPlayerFixture);
        const upgradeCost = hre.ethers.parseEther("100");

        // Deploy MaliciousERC20
        const MaliciousERC20Factory = await hre.ethers.getContractFactory("MaliciousERC20");
        const maliciousToken = await MaliciousERC20Factory.deploy();

        await player.connect(owner).setUpgradeToken(await maliciousToken.getAddress());
        await player.connect(owner).setUpgradeCost(upgradeCost);

        await player.connect(otherAccount).buyToken({ value: price });

        // Mint enough for multiple upgrades and approve
        await maliciousToken.mint(otherAccount.address, upgradeCost * 5n);
        await maliciousToken.connect(otherAccount).approve(await player.getAddress(), upgradeCost * 5n);

        // Set reentrancy params
        await maliciousToken.setReentrancyParams(await player.getAddress(), 1, Attribute.Strength);

        const attrsBefore = await player.getAttributes(1);

        // The reentrancy attempt should fail because msg.sender in the reentrant call
        // will be the malicious token contract, not the player owner
        await expect(
          player.connect(otherAccount).upgradeAttribute(1, Attribute.Strength)
        ).to.be.revertedWith("Not the token owner");

        // Verify attributes unchanged (transaction reverted)
        const attrsAfter = await player.getAttributes(1);
        expect(attrsAfter.strenght).to.equal(attrsBefore.strenght);
      });
    });
  });
});
