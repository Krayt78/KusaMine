import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ONE_ETHER: bigint = 1_000_000_000_000_000_000n;

const PlayerModule = buildModule("PlayerModule", (m) => {
  const price = m.getParameter("price", ONE_ETHER);

  const player = m.contract("Player", [price]);

  return { player };
});

export default PlayerModule;
