import React, { useState } from 'react';
import { useMarketplace } from './useMarketplace';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';

const Marketplace = () => {
  const { listNFTForSale, makeOffer, cancelSale, cancelOffer, buyNFT, transferNFT, acceptOffer, getHighestOffer } = useMarketplace();

  const [tokenId, setTokenId] = useState('');
  const [price, setPrice] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [nftTokens, setNftTokens] = useState([]);
  const [offerId, setOfferId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleListNFTForSale = async (event) => {
    event.preventDefault();
    if (!tokenId || !price) {
      toast.error('Please enter a valid token ID and price.');
      return;
    }

    try {
      await listNFTForSale(Number(tokenId), price);
      toast.success('NFT listed for sale successfully!');
      setNftTokens((prevNfts) => [...prevNfts, { tokenId, isListedForSale: true }]);
    } catch (error) {
      console.error('Failed to list NFT:', error);
      toast.error(`Error listing NFT for sale: ${error.message}`);
    }
  };

  const handleCancelSale = async () => {
    try {
      await cancelSale(tokenId);
      toast.success('Sale canceled successfully!');
      setNftTokens((prevNfts) => prevNfts.filter(nft => nft.tokenId !== tokenId));
    } catch (error) {
      console.error('Failed to cancel sale:', error);
      toast.error('Failed to cancel sale.');
    }
  };

  const handleMakeOffer = async (event) => {
    event.preventDefault();
    if (!tokenId || !price) {
      toast.error('Please enter a valid token ID and price.');
      return;
    }

    try {
      const offerPriceWei = ethers.utils.parseUnits(price.toString(), 'ether');
      await makeOffer(tokenId, offerPriceWei);
      toast.success('Offer made successfully!');
    } catch (error) {
      console.error('Error making offer:', error);
      toast.error(`Error making offer: ${error.message}`);
    }
  };

  const handleAcceptOffer = async () => {
    if (!tokenId) {
      toast.error('Please enter a valid token ID.');
      return;
    }

    try {
      const [offerAmount, offerBidder] = await getHighestOffer(tokenId);
      if (offerAmount.isZero() || offerBidder === ethers.constants.AddressZero) {
        toast.error('No valid offer to accept.');
        return;
      }
      await acceptOffer(tokenId, offerAmount, offerBidder);
      toast.success('Offer accepted successfully!');
      setNftTokens((prevNfts) => prevNfts.filter(nft => nft.tokenId !== tokenId));
    } catch (error) {
      console.error('Error while accepting offer:', error);
      toast.error(`Error accepting offer: ${error.message}`);
    }
  };

  const handleCancelOffer = async () => {
    try {
      await cancelOffer(tokenId);
      toast.success('Offer canceled successfully!');
    } catch (error) {
      console.error('Failed to cancel offer:', error);
      toast.error(`Error canceling offer: ${error.message}`);
    }
  };

  const handleBuyNFT = async () => {
    setLoading(true);
    try {
      const price = await marketplaceContract.getSalePrice(tokenId);
      if (!price) {
        toast.error("This NFT is no longer available for sale.");
        setLoading(false);
        return;
      }

      await buyNFT(tokenId, price);
      toast.success("NFT purchased successfully!");
      setNftTokens((prevNfts) => prevNfts.filter(nft => nft.tokenId !== tokenId));
    } catch (error) {
      console.error("Error purchasing NFT:", error);
      toast.error(`Error purchasing NFT: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferNFT = async () => {
    if (typeof transferNFT !== 'function') {
      toast.error("Transfer function is not loaded correctly.");
      return;
    }

    if (!tokenId || !recipientAddress) {
      toast.error("Please provide both a token ID and a recipient address.");
      return;
    }

    try {
      await transferNFT(tokenId, recipientAddress);
      toast.success("NFT transferred successfully.");
      setNftTokens((prevNfts) => prevNfts.filter(nft => nft.tokenId !== tokenId));
    } catch (error) {
      console.error('Transfer NFT failed:', error);
      toast.error(`Transfer failed: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Marketplace</h2>
      <form>
        <label>
          Token ID:
          <input type="number" value={tokenId} onChange={(e) => setTokenId(e.target.value)} />
        </label>
        <br />
        <label>
          Price:
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <br />
        <label>
          Recipient Address:
          <input type="text" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} />
        </label>
        <br />
        <button onClick={handleListNFTForSale}>List NFT for Sale</button>
        <button onClick={handleCancelSale}>Cancel Sale</button>
        <button onClick={handleMakeOffer}>Make Offer</button>
        <button onClick={handleAcceptOffer}>Accept Offer</button>
        <button onClick={handleCancelOffer}>Cancel Offer</button>
        <button onClick={handleBuyNFT}>Buy NFT</button>
        <button onClick={handleTransferNFT}>Transfer NFT</button>
      </form>
    </div>
  );
};

export default Marketplace;
