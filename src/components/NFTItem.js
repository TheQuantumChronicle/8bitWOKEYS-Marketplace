import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useMarketplace } from './useMarketplace';

function NFTItem({ tokenId, metadata, isListedForSale, price, isOwner, account, makeOffer, buyNFT, listNFTForSale, cancelSale, transferNFT }) {
  const { fetchHighestOffer, currentOffer, setCurrentOffer, acceptOffer, loading, setLoading, fetchIsListedForSale, fetchUpdatedData } = useMarketplace();
  const [isListed, setIsListed] = useState(isListedForSale);
  const [listPrice, setListPrice] = useState(price || '');
  const [offerAmount, setOfferAmount] = useState('');
  const [transferAddress, setTransferAddress] = useState('');
  const [message, setMessage] = useState('');

  const imageUrl = `https://ipfs.io/ipfs/bafybeiab76pyx2vmpyg3q7sb22pjqanf37buxfzv7xov4esr2wfavfdgcu/${tokenId}.png`;

  useEffect(() => {
    const fetchListingStatus = async () => {
      const { isListed, salePrice } = await fetchIsListedForSale(tokenId);
      setIsListed(isListed);
      setListPrice(salePrice || '');
    };

    if (!isListedForSale) {
      fetchListingStatus();
    }
  }, [fetchIsListedForSale, isListedForSale, tokenId]);

  useEffect(() => {
    if (tokenId) {
      fetchHighestOffer(tokenId);
    }
  }, [tokenId, fetchHighestOffer]);

  const handleTransaction = async (transactionFunc, successMessage, errorMessage) => {
    setLoading(true);
    setMessage('');
    try {
      const tx = await transactionFunc();
      if (!tx) {
        throw new Error("Transaction creation failed");
      }
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        setMessage(successMessage);
        return true;
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      if (error.code === 'ACTION_REJECTED') {
        setMessage('Transaction rejected.');
      } else {
        setMessage(`${errorMessage}: ${error.message}`);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSale = async () => {
    const success = await handleTransaction(
      () => cancelSale(tokenId),
      'Sale canceled successfully!',
      'Error cancelling sale'
    );
    if (success) {
      setIsListed(false);
      setListPrice('');
      fetchHighestOffer(tokenId);
      fetchUpdatedData();
    }
  };

  const handleBuyNow = async () => {
    if (!isListed) {
      setMessage("This NFT is no longer available for sale.");
      return;
    }
    const success = await handleTransaction(
      () => buyNFT(tokenId),
      'NFT purchased successfully!',
      'Error purchasing NFT'
    );
    if (success) {
      setIsListed(false);
      if (setCurrentOffer) setCurrentOffer(null); // Ensure setCurrentOffer is defined
      fetchHighestOffer(tokenId);
      fetchUpdatedData(); // Ensure the state is updated after buying
    }
  };

  const handleMakeOffer = async (event) => {
    event.preventDefault();
    if (isOwner) {
      setMessage("You can't make an offer on your own NFT.");
      return;
    }

    const parsedAmount = parseFloat(offerAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setMessage('Please enter a valid offer amount greater than zero.');
      return;
    }

    await handleTransaction(
      () => makeOffer(tokenId, parsedAmount.toString()),
      'Offer made successfully!',
      'Error making offer'
    );
  };

  const handleAcceptOffer = async () => {
    const success = await handleTransaction(
      () => acceptOffer(tokenId),
      'Offer accepted successfully!',
      'Error accepting offer'
    );
    if (success) {
      setIsListed(false);
      if (setCurrentOffer) setCurrentOffer(null); // Ensure setCurrentOffer is defined
    }
  };

  const handleListForSale = async (event) => {
    event.preventDefault();
    if (!isOwner) {
      setMessage("You can't list an NFT for sale that you don't own.");
      return;
    }

    const parsedPrice = parseFloat(listPrice.trim());
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setMessage('Please enter a valid price greater than zero.');
      return;
    }

    const success = await handleTransaction(
      () => listNFTForSale(tokenId, parsedPrice.toString()),
      'NFT listed for sale successfully!',
      'Error listing NFT for sale'
    );
    if (success) {
      setIsListed(true);
      fetchUpdatedData();
    }
  };

  const handleTransferNFT = async () => {
    if (!transferAddress || !ethers.utils.isAddress(transferAddress)) {
      setMessage("Please enter a valid wallet address.");
      return;
    }

    const success = await handleTransaction(
      () => transferNFT(tokenId, transferAddress),
      'NFT transferred successfully.',
      'Transfer failed'
    );
    if (success) {
      setIsListed(false);
      if (setCurrentOffer) setCurrentOffer(null); // Ensure setCurrentOffer is defined
      fetchHighestOffer(tokenId);
      fetchUpdatedData();
    }
  };

  if (!metadata) {
    return <div>Loading NFT data...</div>;
  }

  const itemClassName = `nft-item ${currentOffer?.amount?.gt(0) ? 'has-offer' : ''} ${isListedForSale ? 'for-sale' : ''} ${isOwner ? 'owned' : ''}`;

  return (
    <div className={itemClassName}>
      {currentOffer && currentOffer.amount && currentOffer.amount.gt(0) && (
        <p className="highest-offer" style={{ fontWeight: 'bold' }}>
          Highest Offer: {ethers.utils.formatEther(currentOffer.amount)} ETH
        </p>
      )}
      {isOwner && <p className="owned-message" style={{ color: 'red', fontSize: '1.2em', fontWeight: 'bold' }}>You own this NFT</p>}
      <a href={`https://magmascan.org/token/0xA4F77aE2f6E33d1F4B6470BfAbF0fbD924525De1/instance/${tokenId}`} target="_blank" rel="noopener noreferrer">
        <img src={imageUrl} alt={`NFT ${tokenId}: ${metadata.name}`} className="nft-image" onError={(e) => e.target.src = 'path_to_default_image.png'} />
      </a>
      <div className="metadata">
        <h4>{metadata.name} #{tokenId}</h4>
        <p>{metadata.description}</p>
        {metadata.attributes.map((attribute, index) => (
          <div key={index} className="attribute">{attribute.trait_type}: {attribute.value}</div>
        ))}
        {isListed && (
          <p className="price" style={{ color: 'red', fontWeight: 'bold' }}>
            Sale Price: {listPrice} ETH
          </p>
        )}
      </div>
      <div className="actions">
        {isOwner ? (
          <>
            {isListed ? (
              <>
                <button onClick={handleCancelSale} disabled={loading}>Cancel Sale</button>
              </>
            ) : (
              <>
                <form onSubmit={handleListForSale}>
                  <input type="text" value={listPrice} onChange={(e) => setListPrice(e.target.value.replace(/[^0-9.]/g, ''))} disabled={loading} />
                  <button type="submit" disabled={loading}>List for Sale</button>
                </form>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleTransferNFT();
                }}>
                  <input type="text" value={transferAddress} onChange={(e) => setTransferAddress(e.target.value)} placeholder="Enter recipient wallet address" required disabled={loading} />
                  <button type="submit" disabled={loading}>Transfer NFT</button>
                </form>
              </>
            )}
            {currentOffer && currentOffer.amount && currentOffer.amount.gt(0) && (
              <button onClick={handleAcceptOffer} disabled={loading}>Accept Offer</button>
            )}
          </>
        ) : isListed ? (
          <>
            <button onClick={handleBuyNow} disabled={loading}>Buy Now for <span className="price-highlight">{listPrice} ETH</span></button>
            <form onSubmit={handleMakeOffer}>
              <input type="text" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="Enter offer amount" disabled={loading} />
              <button type="submit" disabled={loading}>Make Offer</button>
            </form>
          </>
        ) : (
          <form onSubmit={handleMakeOffer}>
            <input type="text" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="Enter offer amount" disabled={loading} />
            <button type="submit" disabled={loading}>Make Offer</button>
          </form>
        )}
      </div>
      {message && <p className="message">{message}</p>}
    </div>
  );
}

export default React.memo(NFTItem);
