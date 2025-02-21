import type { NextApiRequest, NextApiResponse } from "next";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  PrivyClient,
  AuthTokenClaims,
  WalletWithMetadata,
} from "@privy-io/server-auth";

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
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
      {
        commitment: "confirmed",
      }
    );

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(delegatedWallet?.address),
        toPubkey: new PublicKey("6Nu9WYbDkGP6BBdYtRncPdDyQMT8QCRqr2jABPb9SpZQ"),
        lamports: 0.0001 * LAMPORTS_PER_SOL,
      })
    );

    // Get the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(delegatedWallet?.address);

    console.log("delegatedWallet", delegatedWallet);
    const { signedTransaction } = await client.walletApi.solana.signTransaction(
      {
        walletId: delegatedWallet?.id,
        transaction,
      }
    );

    console.log("signedTransaction", signedTransaction);
    // const { hash } = await client.walletApi.solana.signAndSendTransaction({
    //   walletId: delegatedWallet?.id,
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
