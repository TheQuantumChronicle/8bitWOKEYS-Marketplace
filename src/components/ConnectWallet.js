import React from 'react';
import { useBlockchain } from './useBlockchain';

function ConnectWallet() {
  const { account, connectWalletHandler, isConnecting, error } = useBlockchain();

  const getTruncatedAccount = () => account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : '';

  return (
    <div className="connect-wallet">
      <button
        onClick={connectWalletHandler}
        className="button"
        disabled={isConnecting}
        aria-label={account ? `Wallet Connected: ${getTruncatedAccount()}` : 'Connect Wallet'}
      >
        {isConnecting ? 'Connecting...' : account ? `Connected: ${getTruncatedAccount()}` : 'Connect Wallet'}
      </button>
      {!account && <p className="connect-message pulsing">Please connect your wallet to view and interact with NFTs.</p>}
      {account && error && <p className="error">{error}</p>}
    </div>
  );
}

export default ConnectWallet;
