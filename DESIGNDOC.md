# KusaMine — Design Document (Draft v0.3)

## 1. Summary
A fully onchain RPG where players mint a **Soulbound Character NFT** and send their character into **mines** to mine for loot and riches. Characters have classic RPG stats (**STR / DEX / INT / LUCK**) and **equipment slots** (Weapon/Armor/Relic). **All equipment and all loot are ERC-1155 tokens** (stackable).  
All game logic and state live onchain; only the UI is offchain (optionally pinned to IPFS later).

Key rule: when a player equips an item, **ownership/custody of that ERC-1155 is transferred out of the wallet and held by the Character system**. To sell or transfer an equipped item, the player must **unequip** it back into their wallet first.

## 2. Goals
- **Fully onchain gameplay:** all state transitions, mining/combat outcomes, loot minting, and progression happen in smart contracts.
- **Composable assets:** items are ERC-1155 and tradeable when in-wallet; character is soulbound.
- **Clear core loop:** mint character → gear up → enter mine → resolve events → extract loot → upgrade → go deeper.
- **Verifiability:** outcomes are deterministically verifiable given the onchain randomness rules.

## 3. Non-goals (for v1)
- AAA graphics / complex world simulation.
- Real-time combat.
- Fully onchain frontend (optional future).

---

## 4. Game Entities

### 4.1 Character (Soulbound NFT)
**Type:** Non-transferable NFT (SBT-style).  
**Represents:** Player avatar + progression.

**Onchain Properties**
- `owner` (account)
- `level`, `xp`
- Base stats: `STR`, `DEX`, `INT`, `LUCK`
- Derived stats (computed): HP, damage, crit chance, dodge, mining speed, etc.
- Equipment slots (each slot references an ERC-1155 `tokenId` and `amount`, typically 1):
  - `weaponSlot`
  - `armorSlot`
  - `relicSlot` (expandable later)

**Soulbound Rule**
- Character cannot be transferred or sold once minted.

**Implementation Notes**
- ERC-721-like interface for compatibility, but block `transferFrom`/`safeTransferFrom` (or use an SBT-oriented standard such as ERC-5192 / EIP-6454 style constraints).
- Prevent transfers even with approvals.

### 4.2 Items & Equipment (ERC-1155)
**Type:** ERC-1155 token ids under one (or multiple) ERC-1155 contracts.  
**Everything in the game is ERC-1155**:
- Loot/resources (gold, ores, gems, consumables)
- Equipment (weapons, armor, relics)

**Equipment Categories (per token id)**
- `itemType`: weapon / armor / relic
- `rarity`
- `requiredLevel` (optional)
- Modifiers (examples)
  - Weapon: +Damage, +Crit, +STR/DEX
  - Armor: +HP, +Defense, +Dodge
  - Relic: special effects (extra loot, resistances, procs)

### 4.3 Equip Custody Rule (Character-owned items)
When equipping an item, the item is **moved out of the player wallet** and held by the game system on behalf of the character.

**Why**
- Prevent using the same item across multiple characters simultaneously.
- Prevent selling/transferring an item while it is equipped.
- Simplifies enforcement during mine runs.

**How (recommended custody model)**
- Items are transferred via `safeTransferFrom(player -> EquipmentVault)` (or directly to the Character contract if it implements ERC-1155 receiver).
- The system records:
  - `equipped[characterId][slot] = {tokenId, amount}`
  - and optionally `vaultBalance[characterId][tokenId] += amount`

**Unequip**
- Player calls `unequip(characterId, slot)` which transfers the ERC-1155 back from the vault to the player wallet.
- Only then can the player sell/transfer the item.

> Note: This is “custody held by character” in gameplay terms. Onchain, the **contract** is the custody holder, and the characterId is the internal accounting key.

---

## 5. Core Gameplay Loop

### 5.1 Loop Overview
1. Player mints Character SBT.
2. Player acquires ERC-1155 items (loot/craft/buy).
3. Player equips weapon/armor/relic:
   - item is transferred to the vault/character custody
4. Player enters a mine (chooses depth/difficulty).
5. Onchain resolution yields:
   - ERC-1155 loot/resource amounts (e.g., gold)
   - XP
   - durability loss / HP loss (optional)
6. Player exits and upgrades (level up, craft, trade items by unequipping first, re-run).

### 5.2 Mine Runs (Onchain)
**Assumption for v1:** Mine run is **step-based** to manage gas and fairness.

**Typical Actions**
- `enterMine(characterId, mineId, depth)`
- `advance(characterId)` → resolves next encounter/event
- `exitMine(characterId)` → finalizes rewards + cleans up run state

**Encounters / Events**
Each step may roll one of:
- Mining node (resource yield, e.g., `GOLD_ID += amount`)
- Monster encounter (combat resolution)
- Trap event (damage / debuff)
- Treasure room (higher rarity roll)
- Special event (rare)

---

## 6. Stats & Resolution

### 6.1 Base Stats
- **STR:** melee damage, mining power
- **DEX:** accuracy, dodge, mining speed, trap avoidance
- **CON:** health, physical resistance
- **INT:** mana, magic damage, magic resistance, relic scaling
- **LUCK:** loot quality/rarity probability, crit chance

### 6.2 Derived Stats (examples)
- `HP = baseHP + CON * a + equipmentBonusHP`
- `Mana = baseMana + INT * b + equipmentBonusMana`
- `Damage = weaponBase + (STR * c_str) + (DEX * c_dex) + equipmentBonusDamage`
- `DodgeChance = baseDodge + (DEX * d) + equipmentBonusDodge`
- `PhysicalResist = basePhysRes + (CON * e) + equipmentBonusPhysRes`
- `MagicResist = baseMagicRes + (INT * f) + equipmentBonusMagicRes`
- `CritChance = baseCrit + (LUCK * g) + equipmentBonusCrit`
- `LootBonus = f(LUCK) + equipmentBonusLoot`
- `TrapAvoidChance = baseTrapAvoid + (DEX * h) + equipmentBonusTrapAvoid`

### 6.3 Combat (Onchain, deterministic)
Keep combat minimal and cheap.

**Simplification for teh start**
- One-roll combat: “Win and take X damage” or “Fail and get ejected.”

Later on players will be able to choose what to do (run, attack, use object/magic ...)

---

## 7. Randomness & Fairness

### 7.1 Options
1. **VRF:** Chainlink VRF (EVM) or chain-native VRF.
2. **Commit–reveal:** player commits hash(secret) then reveals secret later.
3. **Native randomness / RANDAO:** chain-dependent.

### 7.2 for v1
- Use **VRF** (or strong chain-native randomness) if available.

---

## 8. Onchain Architecture

### 8.1 Contracts / Modules (suggested)
- **CharacterSBT (ERC-721-like, non-transferable):**
  - minting, stat storage, leveling, equipped slot state
  - has an EquipmentVault
- **GameItems1155 (ERC-1155):**
  - all token ids (gold, ores, weapons, armor, relics, etc.)
- **EquipmentVault (ERC-1155 receiver + accounting):**
  - holds equipped items in custody per characterId
  - transfers items back on unequip
- **MineSystem:**
  - manages mine runs, encounters, loot tables, run state
- **ProgressionSystem:**
  - XP, leveling, stat allocation rules
- **Crafting/Forge (optional):**
  - convert ores → items, upgrades, sinks

### 8.2 Token ID Strategy (ERC-1155)
- `1 = GOLD`
- `2 = IRON`
- `1001 = WEAPON_BRONZE_SWORD`
- `2001 = ARMOR_LEATHER`
- `3001 = RELIC_LUCKY_CHARM`
---

## 9. Economy

### 9.1 Entry Cost
- Character mint price to:
  - deter sybil/bot farms
  - fund randomness costs / treasury

Later on with PoP we could airdrop SBTs directly to teh players that are Ided by PoP.

### 9.2 Sources & Sinks
**Sources**
- Loot from mining/combat (ERC-1155 mints)
- Crafting outputs (implemented later on)

**Sinks**
- Upgrade player's attributes (soft cap ala black desert ?)
- Crafting Inputs

### 9.3 Trade
- Character cannot be sold (SBT).
- Items can be traded when in-wallet.
- Equipped items cannot be traded until **unequipped**.

---

## 10. Frontend & IPFS (Future)
- UI reads from:
  - contract calls (current state)
  - event logs (history)
- Optional: deploy UI to IPFS.

---

## 11. Security & Abuse Considerations

### 11.1 Key Risks
- RNG manipulation
- Balance issues

---

## 12. MVP Scope
- Character mint (SBT)
- Basic stats + upgrading them
- One ERC-1155 contract for all items/loot/equipment
- Equipment vault custody model (equip transfers into vault; unequip returns to wallet)
- 1 mine with depth scaling
- Step-based exploration (3–10 steps/run)
- Loot tables: ores + chance of equipment drops (all ERC-1155)
- Simple combat resolution