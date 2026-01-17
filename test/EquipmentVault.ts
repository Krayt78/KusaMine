import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("EquipmentVault", function () {
  // Equipment slot enum values matching the contract
  const Slot = {
    ARMOR: 0,
    WEAPON: 1,
    RELIC: 2,
  };

  async function deployFixture() {
    const price = hre.ethers.parseEther("0.1");

    const [owner, player1, player2] = await hre.ethers.getSigners();

    // Deploy Player contract
    const Player = await hre.ethers.getContractFactory("Player");
    const player = await Player.deploy(price, hre.ethers.ZeroAddress);

    // Deploy MockEquipment contract
    const MockEquipment = await hre.ethers.getContractFactory("MockEquipment");
    const equipment = await MockEquipment.deploy();

    return { player, equipment, price, owner, player1, player2 };
  }

  async function deployWithEquipmentSetupFixture() {
    const { player, equipment, price, owner, player1, player2 } = await loadFixture(deployFixture);

    // Set up equipment contract
    await player.connect(owner).setEquipmentContract(await equipment.getAddress());

    // Mint player tokens
    await player.connect(player1).buyToken({ value: price });
    await player.connect(player2).buyToken({ value: price });

    // Create equipment items for player1
    // Token type 1: ARMOR slot
    await equipment.createTokenType(player1.address, 1, Slot.ARMOR, "0x");
    // Token type 2: WEAPON slot
    await equipment.createTokenType(player1.address, 1, Slot.WEAPON, "0x");
    // Token type 3: RELIC slot
    await equipment.createTokenType(player1.address, 1, Slot.RELIC, "0x");

    // Player1 approves the Player contract to transfer equipment
    await equipment.connect(player1).setApprovalForAll(await player.getAddress(), true);

    return { player, equipment, price, owner, player1, player2 };
  }

  describe("setEquipmentContract()", function () {
    it("Should allow owner to set equipment contract", async function () {
      const { player, equipment, owner } = await loadFixture(deployFixture);

      await player.connect(owner).setEquipmentContract(await equipment.getAddress());

      expect(await player.getEquipmentContract()).to.equal(await equipment.getAddress());
    });

    it("Should emit EquipmentContractSet event", async function () {
      const { player, equipment, owner } = await loadFixture(deployFixture);

      await expect(player.connect(owner).setEquipmentContract(await equipment.getAddress()))
        .to.emit(player, "EquipmentContractSet")
        .withArgs(await equipment.getAddress());
    });

    it("Should revert when non-owner calls setEquipmentContract", async function () {
      const { player, equipment, player1 } = await loadFixture(deployFixture);

      await expect(
        player.connect(player1).setEquipmentContract(await equipment.getAddress())
      ).to.be.revertedWithCustomError(player, "OwnableUnauthorizedAccount")
        .withArgs(player1.address);
    });

    it("Should revert when setting equipment contract twice", async function () {
      const { player, equipment, owner } = await loadFixture(deployFixture);

      await player.connect(owner).setEquipmentContract(await equipment.getAddress());

      // Deploy another equipment contract to try setting
      const MockEquipment2 = await hre.ethers.getContractFactory("MockEquipment");
      const equipment2 = await MockEquipment2.deploy();

      await expect(
        player.connect(owner).setEquipmentContract(await equipment2.getAddress())
      ).to.be.revertedWith("Equipment contract already set");
    });

    it("Should revert when setting equipment contract to zero address", async function () {
      const { player, owner } = await loadFixture(deployFixture);

      await expect(
        player.connect(owner).setEquipmentContract(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid equipment contract");
    });
  });

  describe("equip()", function () {
    describe("Happy path", function () {
      it("Should equip an item to the correct slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        const [tokenType, amount] = await player.getEquippedItem(1, Slot.ARMOR);
        expect(tokenType).to.equal(1);
        expect(amount).to.equal(1);
      });

      it("Should transfer item from player to vault", async function () {
        const { player, equipment, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        const playerBalanceBefore = await equipment.balanceOf(player1.address, 1);
        const vaultBalanceBefore = await equipment.balanceOf(await player.getAddress(), 1);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        const playerBalanceAfter = await equipment.balanceOf(player1.address, 1);
        const vaultBalanceAfter = await equipment.balanceOf(await player.getAddress(), 1);

        expect(playerBalanceBefore - playerBalanceAfter).to.equal(1);
        expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(1);
      });

      it("Should update vault balance tracking", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        expect(await player.getVaultBalance(1, 1)).to.equal(0);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        expect(await player.getVaultBalance(1, 1)).to.equal(1);
      });

      it("Should emit ItemEquipped event", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await expect(player.connect(player1).equip(1, Slot.ARMOR, 1, 1))
          .to.emit(player, "ItemEquipped")
          .withArgs(1, Slot.ARMOR, 1, 1);
      });

      it("Should mark slot as equipped", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.false;

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.true;
      });
    });

    describe("Equipping to different slots", function () {
      it("Should equip armor to ARMOR slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        const [tokenType, amount] = await player.getEquippedItem(1, Slot.ARMOR);
        expect(tokenType).to.equal(1);
        expect(amount).to.equal(1);
      });

      it("Should equip weapon to WEAPON slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.WEAPON, 2, 1);

        const [tokenType, amount] = await player.getEquippedItem(1, Slot.WEAPON);
        expect(tokenType).to.equal(2);
        expect(amount).to.equal(1);
      });

      it("Should equip relic to RELIC slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.RELIC, 3, 1);

        const [tokenType, amount] = await player.getEquippedItem(1, Slot.RELIC);
        expect(tokenType).to.equal(3);
        expect(amount).to.equal(1);
      });

      it("Should allow equipping all three slots simultaneously", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
        await player.connect(player1).equip(1, Slot.WEAPON, 2, 1);
        await player.connect(player1).equip(1, Slot.RELIC, 3, 1);

        expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.true;
        expect(await player.isSlotEquipped(1, Slot.WEAPON)).to.be.true;
        expect(await player.isSlotEquipped(1, Slot.RELIC)).to.be.true;
      });
    });

    describe("Auto-unequip on slot conflict", function () {
      it("Should unequip previous item when equipping to occupied slot", async function () {
        const { player, equipment, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        // Create a second armor item
        await equipment.createTokenType(player1.address, 1, Slot.ARMOR, "0x");

        // Equip first armor
        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        // Equip second armor (should auto-unequip first)
        await player.connect(player1).equip(1, Slot.ARMOR, 4, 1);

        const [tokenType, amount] = await player.getEquippedItem(1, Slot.ARMOR);
        expect(tokenType).to.equal(4);
        expect(amount).to.equal(1);
      });

      it("Should return previous item to player when auto-unequipping", async function () {
        const { player, equipment, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        // Create a second armor item
        await equipment.createTokenType(player1.address, 1, Slot.ARMOR, "0x");

        // Equip first armor
        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
        expect(await equipment.balanceOf(player1.address, 1)).to.equal(0);

        // Equip second armor
        await player.connect(player1).equip(1, Slot.ARMOR, 4, 1);

        // First armor should be returned to player
        expect(await equipment.balanceOf(player1.address, 1)).to.equal(1);
      });

      it("Should emit both ItemUnequipped and ItemEquipped events", async function () {
        const { player, equipment, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        // Create a second armor item
        await equipment.createTokenType(player1.address, 1, Slot.ARMOR, "0x");

        // Equip first armor
        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        // Equip second armor
        await expect(player.connect(player1).equip(1, Slot.ARMOR, 4, 1))
          .to.emit(player, "ItemUnequipped")
          .withArgs(1, Slot.ARMOR, 1, 1)
          .and.to.emit(player, "ItemEquipped")
          .withArgs(1, Slot.ARMOR, 4, 1);
      });

      it("Should update vault balance correctly on auto-unequip", async function () {
        const { player, equipment, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        // Create a second armor item
        await equipment.createTokenType(player1.address, 1, Slot.ARMOR, "0x");

        // Equip first armor
        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
        expect(await player.getVaultBalance(1, 1)).to.equal(1);

        // Equip second armor
        await player.connect(player1).equip(1, Slot.ARMOR, 4, 1);

        expect(await player.getVaultBalance(1, 1)).to.equal(0);
        expect(await player.getVaultBalance(1, 4)).to.equal(1);
      });
    });

    describe("Failure cases", function () {
      it("Should revert when equipment contract not set", async function () {
        const { player, price, player1 } = await loadFixture(deployFixture);

        // Buy token but don't set equipment contract
        await player.connect(player1).buyToken({ value: price });

        await expect(
          player.connect(player1).equip(1, Slot.ARMOR, 1, 1)
        ).to.be.revertedWith("Equipment contract not set");
      });

      it("Should revert when caller doesn't own the player token", async function () {
        const { player, player2 } = await loadFixture(deployWithEquipmentSetupFixture);

        await expect(
          player.connect(player2).equip(1, Slot.ARMOR, 1, 1)
        ).to.be.revertedWith("Not player owner");
      });

      it("Should revert when item slot doesn't match target slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        // Token type 1 is ARMOR slot, but trying to equip to WEAPON slot
        await expect(
          player.connect(player1).equip(1, Slot.WEAPON, 1, 1)
        ).to.be.revertedWith("Item slot mismatch");
      });

      it("Should revert when player doesn't own the item", async function () {
        const { player, equipment, player1, player2 } = await loadFixture(deployWithEquipmentSetupFixture);

        // Create armor for player2
        await equipment.createTokenType(player2.address, 1, Slot.ARMOR, "0x");
        await equipment.connect(player2).setApprovalForAll(await player.getAddress(), true);

        // Player1 tries to equip player2's armor to their character
        await expect(
          player.connect(player1).equip(1, Slot.ARMOR, 4, 1)
        ).to.be.revertedWith("Insufficient item balance");
      });

      it("Should revert when player has insufficient item balance", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        // Player1 has 1 armor, trying to equip 2
        await expect(
          player.connect(player1).equip(1, Slot.ARMOR, 1, 2)
        ).to.be.revertedWith("Insufficient item balance");
      });

      it("Should revert when player hasn't approved the vault", async function () {
        const { player, equipment, price, owner, player1 } = await loadFixture(deployFixture);

        // Set up equipment contract
        await player.connect(owner).setEquipmentContract(await equipment.getAddress());
        await player.connect(player1).buyToken({ value: price });

        // Create armor for player1 but DON'T approve
        await equipment.createTokenType(player1.address, 1, Slot.ARMOR, "0x");

        await expect(
          player.connect(player1).equip(1, Slot.ARMOR, 1, 1)
        ).to.be.reverted; // ERC1155 reverts with missing approval
      });
    });
  });

  describe("unequip()", function () {
    describe("Happy path", function () {
      it("Should unequip an item from a slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
        await player.connect(player1).unequip(1, Slot.ARMOR);

        const [tokenType, amount] = await player.getEquippedItem(1, Slot.ARMOR);
        expect(tokenType).to.equal(0);
        expect(amount).to.equal(0);
      });

      it("Should transfer item back to player", async function () {
        const { player, equipment, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
        expect(await equipment.balanceOf(player1.address, 1)).to.equal(0);

        await player.connect(player1).unequip(1, Slot.ARMOR);
        expect(await equipment.balanceOf(player1.address, 1)).to.equal(1);
      });

      it("Should update vault balance tracking", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
        expect(await player.getVaultBalance(1, 1)).to.equal(1);

        await player.connect(player1).unequip(1, Slot.ARMOR);
        expect(await player.getVaultBalance(1, 1)).to.equal(0);
      });

      it("Should emit ItemUnequipped event", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        await expect(player.connect(player1).unequip(1, Slot.ARMOR))
          .to.emit(player, "ItemUnequipped")
          .withArgs(1, Slot.ARMOR, 1, 1);
      });

      it("Should mark slot as unequipped", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
        expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.true;

        await player.connect(player1).unequip(1, Slot.ARMOR);
        expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.false;
      });
    });

    describe("Unequipping from different slots", function () {
      it("Should unequip from ARMOR slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
        await player.connect(player1).unequip(1, Slot.ARMOR);

        expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.false;
      });

      it("Should unequip from WEAPON slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.WEAPON, 2, 1);
        await player.connect(player1).unequip(1, Slot.WEAPON);

        expect(await player.isSlotEquipped(1, Slot.WEAPON)).to.be.false;
      });

      it("Should unequip from RELIC slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.RELIC, 3, 1);
        await player.connect(player1).unequip(1, Slot.RELIC);

        expect(await player.isSlotEquipped(1, Slot.RELIC)).to.be.false;
      });
    });

    describe("Failure cases", function () {
      it("Should revert when caller doesn't own the player token", async function () {
        const { player, player1, player2 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        await expect(
          player.connect(player2).unequip(1, Slot.ARMOR)
        ).to.be.revertedWith("Not player owner");
      });

      it("Should revert when slot is already empty", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await expect(
          player.connect(player1).unequip(1, Slot.ARMOR)
        ).to.be.revertedWith("Slot is empty");
      });
    });
  });

  describe("View functions", function () {
    describe("getEquipmentContract()", function () {
      it("Should return zero address when not set", async function () {
        const { player } = await loadFixture(deployFixture);

        expect(await player.getEquipmentContract()).to.equal(hre.ethers.ZeroAddress);
      });

      it("Should return correct address when set", async function () {
        const { player, equipment, owner } = await loadFixture(deployFixture);

        await player.connect(owner).setEquipmentContract(await equipment.getAddress());

        expect(await player.getEquipmentContract()).to.equal(await equipment.getAddress());
      });
    });

    describe("getEquippedItem()", function () {
      it("Should return zero values for empty slot", async function () {
        const { player } = await loadFixture(deployWithEquipmentSetupFixture);

        const [tokenType, amount] = await player.getEquippedItem(1, Slot.ARMOR);
        expect(tokenType).to.equal(0);
        expect(amount).to.equal(0);
      });

      it("Should return correct values for equipped slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        const [tokenType, amount] = await player.getEquippedItem(1, Slot.ARMOR);
        expect(tokenType).to.equal(1);
        expect(amount).to.equal(1);
      });
    });

    describe("isSlotEquipped()", function () {
      it("Should return false for empty slot", async function () {
        const { player } = await loadFixture(deployWithEquipmentSetupFixture);

        expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.false;
        expect(await player.isSlotEquipped(1, Slot.WEAPON)).to.be.false;
        expect(await player.isSlotEquipped(1, Slot.RELIC)).to.be.false;
      });

      it("Should return true for equipped slot", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.true;
      });
    });

    describe("getVaultBalance()", function () {
      it("Should return zero for non-vaulted items", async function () {
        const { player } = await loadFixture(deployWithEquipmentSetupFixture);

        expect(await player.getVaultBalance(1, 1)).to.equal(0);
        expect(await player.getVaultBalance(1, 999)).to.equal(0);
      });

      it("Should return correct balance for vaulted items", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

        expect(await player.getVaultBalance(1, 1)).to.equal(1);
      });

      it("Should track multiple items separately", async function () {
        const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

        await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
        await player.connect(player1).equip(1, Slot.WEAPON, 2, 1);
        await player.connect(player1).equip(1, Slot.RELIC, 3, 1);

        expect(await player.getVaultBalance(1, 1)).to.equal(1);
        expect(await player.getVaultBalance(1, 2)).to.equal(1);
        expect(await player.getVaultBalance(1, 3)).to.equal(1);
      });
    });
  });

  describe("ERC165 supportsInterface", function () {
    it("Should support IERC1155Receiver interface", async function () {
      const { player } = await loadFixture(deployFixture);

      // IERC1155Receiver interface ID
      const IERC1155ReceiverInterfaceId = "0x4e2312e0";
      expect(await player.supportsInterface(IERC1155ReceiverInterfaceId)).to.be.true;
    });

    it("Should support ERC165 interface", async function () {
      const { player } = await loadFixture(deployFixture);

      // ERC165 interface ID
      const ERC165InterfaceId = "0x01ffc9a7";
      expect(await player.supportsInterface(ERC165InterfaceId)).to.be.true;
    });

    it("Should support ERC721 interface", async function () {
      const { player } = await loadFixture(deployFixture);

      // ERC721 interface ID
      const ERC721InterfaceId = "0x80ac58cd";
      expect(await player.supportsInterface(ERC721InterfaceId)).to.be.true;
    });
  });

  describe("ERC1155Receiver callbacks", function () {
    it("Should return correct selector for onERC1155Received", async function () {
      const { player, equipment, price, owner, player1 } = await loadFixture(deployFixture);

      await player.connect(owner).setEquipmentContract(await equipment.getAddress());
      await player.connect(player1).buyToken({ value: price });
      await equipment.createTokenType(player1.address, 1, Slot.ARMOR, "0x");
      await equipment.connect(player1).setApprovalForAll(await player.getAddress(), true);

      // The equip function internally uses safeTransferFrom which calls onERC1155Received
      // If the callback doesn't return the correct selector, the transfer would revert
      await expect(player.connect(player1).equip(1, Slot.ARMOR, 1, 1)).to.not.be.reverted;
    });

    it("Should accept direct ERC1155 transfers", async function () {
      const { player, equipment, price, owner, player1 } = await loadFixture(deployFixture);

      await player.connect(owner).setEquipmentContract(await equipment.getAddress());
      await player.connect(player1).buyToken({ value: price });
      await equipment.createTokenType(player1.address, 1, Slot.ARMOR, "0x");

      // Direct transfer to vault should work (though not recommended usage)
      await expect(
        equipment.connect(player1).safeTransferFrom(
          player1.address,
          await player.getAddress(),
          1,
          1,
          "0x"
        )
      ).to.not.be.reverted;
    });
  });

  describe("Multi-player scenarios", function () {
    it("Should track equipment separately for different players", async function () {
      const { player, equipment, player1, player2 } = await loadFixture(deployWithEquipmentSetupFixture);

      // Create armor for player2
      await equipment.createTokenType(player2.address, 1, Slot.ARMOR, "0x");
      await equipment.connect(player2).setApprovalForAll(await player.getAddress(), true);

      // Player1 equips their armor (token type 1)
      await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);

      // Player2 equips their armor (token type 4)
      await player.connect(player2).equip(2, Slot.ARMOR, 4, 1);

      // Check player 1's equipment
      const [player1TokenType, player1Amount] = await player.getEquippedItem(1, Slot.ARMOR);
      expect(player1TokenType).to.equal(1);
      expect(player1Amount).to.equal(1);

      // Check player 2's equipment
      const [player2TokenType, player2Amount] = await player.getEquippedItem(2, Slot.ARMOR);
      expect(player2TokenType).to.equal(4);
      expect(player2Amount).to.equal(1);
    });

    it("Should not allow player to equip to another player's character", async function () {
      const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

      // Player1 tries to equip to player2's character (token ID 2)
      await expect(
        player.connect(player1).equip(2, Slot.ARMOR, 1, 1)
      ).to.be.revertedWith("Not player owner");
    });

    it("Should not allow player to unequip from another player's character", async function () {
      const { player, equipment, player1, player2 } = await loadFixture(deployWithEquipmentSetupFixture);

      // Create and equip armor for player2
      await equipment.createTokenType(player2.address, 1, Slot.ARMOR, "0x");
      await equipment.connect(player2).setApprovalForAll(await player.getAddress(), true);
      await player.connect(player2).equip(2, Slot.ARMOR, 4, 1);

      // Player1 tries to unequip from player2's character
      await expect(
        player.connect(player1).unequip(2, Slot.ARMOR)
      ).to.be.revertedWith("Not player owner");
    });

    it("Should track vault balances separately per player", async function () {
      const { player, equipment, player1, player2 } = await loadFixture(deployWithEquipmentSetupFixture);

      // Create armor for player2 (same token type for testing)
      await equipment.mint(player2.address, 1, 1);
      await equipment.connect(player2).setApprovalForAll(await player.getAddress(), true);

      // Both players equip the same token type
      await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
      await player.connect(player2).equip(2, Slot.ARMOR, 1, 1);

      // Each player's vault balance should be tracked separately
      expect(await player.getVaultBalance(1, 1)).to.equal(1);
      expect(await player.getVaultBalance(2, 1)).to.equal(1);
    });
  });

  describe("Edge cases", function () {
    it("Should handle equipping and unequipping multiple times", async function () {
      const { player, equipment, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

      // Equip -> Unequip -> Equip -> Unequip
      await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
      await player.connect(player1).unequip(1, Slot.ARMOR);
      await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
      await player.connect(player1).unequip(1, Slot.ARMOR);

      expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.false;
      expect(await equipment.balanceOf(player1.address, 1)).to.equal(1);
      expect(await player.getVaultBalance(1, 1)).to.equal(0);
    });

    it("Should handle equipping items with amount > 1", async function () {
      const { player, equipment, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

      // Mint additional copies of the armor
      await equipment.mint(player1.address, 1, 4); // Now has 5 total

      // Equip 3 at once
      await player.connect(player1).equip(1, Slot.ARMOR, 1, 3);

      const [tokenType, amount] = await player.getEquippedItem(1, Slot.ARMOR);
      expect(tokenType).to.equal(1);
      expect(amount).to.equal(3);
      expect(await player.getVaultBalance(1, 1)).to.equal(3);
      expect(await equipment.balanceOf(player1.address, 1)).to.equal(2);
    });

    it("Should handle unequipping items with amount > 1", async function () {
      const { player, equipment, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

      // Mint additional copies and equip 3
      await equipment.mint(player1.address, 1, 4);
      await player.connect(player1).equip(1, Slot.ARMOR, 1, 3);

      // Unequip
      await player.connect(player1).unequip(1, Slot.ARMOR);

      expect(await equipment.balanceOf(player1.address, 1)).to.equal(5);
      expect(await player.getVaultBalance(1, 1)).to.equal(0);
    });

    it("Should not affect other slots when equipping/unequipping", async function () {
      const { player, player1 } = await loadFixture(deployWithEquipmentSetupFixture);

      // Equip all three slots
      await player.connect(player1).equip(1, Slot.ARMOR, 1, 1);
      await player.connect(player1).equip(1, Slot.WEAPON, 2, 1);
      await player.connect(player1).equip(1, Slot.RELIC, 3, 1);

      // Unequip just the weapon
      await player.connect(player1).unequip(1, Slot.WEAPON);

      // Armor and relic should still be equipped
      expect(await player.isSlotEquipped(1, Slot.ARMOR)).to.be.true;
      expect(await player.isSlotEquipped(1, Slot.WEAPON)).to.be.false;
      expect(await player.isSlotEquipped(1, Slot.RELIC)).to.be.true;
    });
  });
});
