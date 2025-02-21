import {
  usePrivy,
  useSolanaWallets,
  useDelegatedActions,
  type WalletWithMetadata,
} from "@privy-io/react-auth";

export default function DelegateActionButton() {
  const { user } = usePrivy();
  const { ready, wallets } = useSolanaWallets(); // or useWallets()
  const { delegateWallet } = useDelegatedActions();

  // Find the embedded wallet to delegate from the array of the user's wallets
  const walletToDelegate = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );

  // Check if the wallet to delegate by inspecting the user's linked accounts
  const isAlreadyDelegated = !!user?.linkedAccounts?.find(
    (account): account is WalletWithMetadata =>
      account.type === "wallet" && account.delegated
  );

  const onDelegate = async () => {
    if (!walletToDelegate || !ready) return; // Button is disabled to prevent this case
    await delegateWallet({
      address: walletToDelegate.address,
      chainType: "solana",
    }); // or chainType: 'ethereum'
  };

  return (
    <>
      {isAlreadyDelegated ? (
        <button
          className="text-sm border border-violet-600 hover:border-violet-700 py-2 px-4 rounded-md text-violet-600 hover:text-violet-700 disabled:border-gray-500 disabled:text-gray-500 hover:disabled:text-gray-500"
          disabled={true}
        >
          Delegated account
        </button>
      ) : (
        <button
          className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white"
          onClick={onDelegate}
        >
          Delegate access
        </button>
      )}
    </>
  );
}
