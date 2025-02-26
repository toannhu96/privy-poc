import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import {
  Keypair,
  PublicKey,
  Transaction,
  Connection,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import { BN } from "bn.js";
import axios from "axios";
interface CreateDLMMPositionParameters {
  walletAddress: string;
  poolAddress: string;
  amount: string;
}

// TODO: hardcode the pool address
// https://app.meteora.ag/dlmm/BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh
export const getDLMMPool = async () => {
  const response = await axios.get(
    "https://app.meteora.ag/clmm-api/pair/BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh"
  );
  return response.data;
};

export const createDLMMPosition = async (
  connection: Connection,
  newPosition: Keypair,
  parameters: CreateDLMMPositionParameters
) => {
  const user = new PublicKey(parameters.walletAddress);
  const dlmmPool = await getDLMM(connection, parameters.poolAddress);
  const activeBin = await getActiveBin(dlmmPool);
  const activeBinPricePerToken = Number(activeBin.pricePerToken);
  const TOKEN_X_DECIMALS = dlmmPool.tokenX.decimal;
  const TOKEN_Y_DECIMALS = dlmmPool.tokenY.decimal;
  const minBinId = activeBin.binId - 34;
  const maxBinId = activeBin.binId + 34;

  const totalXAmount = new BN(
    Number(parameters.amount) * 10 ** TOKEN_X_DECIMALS
  );

  const totalYAmount = new BN(
    Math.floor(
      Number(parameters.amount) *
        activeBinPricePerToken *
        10 ** TOKEN_Y_DECIMALS
    )
  );

  const createPositionTx: Transaction =
    await dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: newPosition.publicKey,
      user: user,
      totalXAmount,
      totalYAmount,
      strategy: {
        maxBinId,
        minBinId,
        strategyType: StrategyType.SpotBalanced,
      },
    });

  try {
    const messageV0 = new TransactionMessage({
      instructions: createPositionTx.instructions,
      payerKey: new PublicKey(parameters.walletAddress),
      recentBlockhash: (await connection.getLatestBlockhash("finalized"))
        .blockhash,
    }).compileToV0Message();

    return new VersionedTransaction(messageV0);
  } catch (error) {
    throw new Error(`Failed to create position: ${JSON.stringify(error)}`);
  }
};

const getDLMM = async (connection: Connection, poolAddress: string) => {
  const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
  return dlmmPool;
};

const getActiveBin = async (dlmmPool: DLMM) => {
  const activeBin = await dlmmPool.getActiveBin();
  return activeBin;
};
