import type { NextApiRequest, NextApiResponse } from "next";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import * as nacl from "tweetnacl";
import {
  PrivyClient,
  AuthTokenClaims,
  WalletWithMetadata,
} from "@privy-io/server-auth";
import { createDLMMPosition } from "../service/meteora";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const client = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!);

export type AuthenticateSuccessResponse = {
  claims: AuthTokenClaims;
};

export type AuthenticationErrorResponse = {
  error: string;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    AuthenticateSuccessResponse | AuthenticationErrorResponse
  >
) {
  const headerAuthToken = req.headers.authorization?.replace(/^Bearer /, "");
  const cookieAuthToken = req.cookies["privy-token"];

  const authToken = cookieAuthToken || headerAuthToken;
  if (!authToken) return res.status(401).json({ error: "Missing auth token" });

  try {
    const claims = await client.verifyAuthToken(authToken);

    const user = await client.getUserById(claims.userId);

    const embeddedWallets = user.linkedAccounts.filter(
      (account): account is WalletWithMetadata =>
        account.type === "wallet" && account.walletClientType === "privy"
    );

    const delegatedWallets = embeddedWallets.filter(
      (wallet) => wallet.delegated
    );

    if (delegatedWallets.length === 0) {
      return res.status(401).json({ error: "No delegated wallet found" });
    }

    const delegatedWallet = delegatedWallets[0];

    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com",
      {
        commitment: "confirmed",
      }
    );

    // const transaction = new Transaction().add(
    //   SystemProgram.transfer({
    //     fromPubkey: new PublicKey(delegatedWallet?.address),
    //     toPubkey: new PublicKey("6Nu9WYbDkGP6BBdYtRncPdDyQMT8QCRqr2jABPb9SpZQ"),
    //     lamports: 0.0001 * LAMPORTS_PER_SOL,
    //   })
    // );

    const newPosition = new Keypair();
    const transaction = await createDLMMPosition(connection, newPosition, {
      walletAddress: delegatedWallet?.address,
      poolAddress: "BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh",
      amount: "0.001",
    });

    console.log("delegatedWallet", delegatedWallet);
    transaction.sign([newPosition]);
    const { signedTransaction } = await client.walletApi.solana.signTransaction(
      {
        address: delegatedWallet?.address,
        chainType: "solana",
        transaction,
      }
    );

    console.log("signedTransaction", signedTransaction);

    // let newPositionSignature = nacl.sign.detached(
    //   signedTransaction.serialize(),
    //   newPosition.secretKey
    // );

    const hash = await connection.sendRawTransaction(
      signedTransaction.serialize()
    );
    console.log("hash", hash);

    // const { hash } = await client.walletApi.solana.signAndSendTransaction({
    //   address: delegatedWallet?.address,
    //   chainType: "solana",
    //   caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    //   transaction,
    // });
    // console.log("txHash", hash);

    return res.status(200).json({ claims });
  } catch (e: any) {
    console.error(e);
    return res.status(401).json({ error: e.message });
  }
}

export default handler;
