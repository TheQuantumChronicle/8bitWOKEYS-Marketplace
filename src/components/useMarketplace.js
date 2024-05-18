import { useState, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import marketContractABI from '../marketContractABI.json';
import nftContractABI from '../contractABI.json';
import { useBlockchain } from './useBlockchain';

export const useMarketplace = () => {
  const {
    account,
    notifySuccess,
    notifyError,
    MARKET_CONTRACT_ADDRESS,
    NFT_CONTRACT_ADDRESS,
    fetchMetadata,
    fetchOwnedNFTs,
    setCurrentNFTs,
    setDisplayNFTs,
    isCorrectNetwork
  } = useBlockchain();

  const [loading, setLoading] = useState(false);
  const [forSaleNFTs, setForSaleNFTs] = useState([]);
  const [currentOffer, setCurrentOffer] = useState(null);
  const [salePrice, setSalePrice] = useState(null);

  const provider = useMemo(() => new ethers.providers.Web3Provider(window.ethereum), []);
  const signer = useMemo(() => provider.getSigner(), [provider]);
  const marketplaceContract = useMemo(() => new ethers.Contract(MARKET_CONTRACT_ADDRESS, marketContractABI, signer), [MARKET_CONTRACT_ADDRESS, signer]);
  const nftContract = useMemo(() => new ethers.Contract(NFT_CONTRACT_ADDRESS, nftContractABI, signer), [NFT_CONTRACT_ADDRESS, signer]);

  const fetchIsListedForSale = useCallback(async (tokenId) => {
    try {
      const isListed = await marketplaceContract.isListed(tokenId);
      if (isListed) {
        const salePrice = await marketplaceContract.getSalePrice(tokenId);
        return { isListed, salePrice: ethers.utils.formatUnits(salePrice, 'ether') };
      }
      return { isListed, salePrice: null };
    } catch (error) {
      notifyError(`Error checking if tokenId ${tokenId} is listed: ${error.message}`);
      return { isListed: false, salePrice: null };
    }
  }, [marketplaceContract, notifyError]);

  const fetchUpdatedData = useCallback(async () => {
    if (!account || !isCorrectNetwork) {
      return;
    }
    try {
      const ownedNFTIds = await fetchOwnedNFTs();
      if (!ownedNFTIds.length) {
        setCurrentNFTs([]);
        setDisplayNFTs([]);
        return;
      }
      const fetchMetadataPromises = ownedNFTIds.map(nft => fetchMetadata(nft.tokenId));
      const fetchedMetadata = await Promise.all(fetchMetadataPromises);
      const listedResults = await Promise.all(ownedNFTIds.map(nft => fetchIsListedForSale(nft.tokenId)));
      const nfts = ownedNFTIds.map((nft, index) => ({
        tokenId: nft.tokenId,
        isOwner: true,
        isListedForSale: listedResults[index].isListed,
        price: listedResults[index].salePrice,
        metadata: fetchedMetadata[index]
      }));
      setCurrentNFTs(nfts);
      setDisplayNFTs(nfts);
    } catch (error) {
      notifyError(`Failed to fetch updated NFTs: ${error.message}`);
    }
  }, [fetchOwnedNFTs, fetchMetadata, fetchIsListedForSale, setCurrentNFTs, setDisplayNFTs, notifyError, account, isCorrectNetwork]);

  const checkAndRequestApproval = useCallback(async () => {
    if (!account || !isCorrectNetwork) {
      notifyError('Please connect your wallet and ensure you are on the correct network.');
      return false;
    }
    const isApproved = await nftContract.isApprovedForAll(account, MARKET_CONTRACT_ADDRESS);
    if (!isApproved) {
      try {
        const tx = await nftContract.setApprovalForAll(MARKET_CONTRACT_ADDRESS, true);
        await tx.wait();
        notifySuccess('Marketplace authorized successfully.');
        return true;
      } catch (error) {
        notifyError(`Failed to authorize marketplace: ${error.message}`);
        return false;
      }
    }
    return true;
  }, [nftContract, account, MARKET_CONTRACT_ADDRESS, notifySuccess, notifyError, isCorrectNetwork]);

  const listNFTForSale = useCallback(async (tokenId, price) => {
    if (!account || !isCorrectNetwork) {
      notifyError('Please connect your wallet and ensure you are on the correct network.');
      return null;
    }
    setLoading(true);
    const approved = await checkAndRequestApproval();
    if (!approved) {
      setLoading(false);
      return;
    }
    try {
      const isAlreadyListed = await marketplaceContract.isListed(tokenId);
      if (isAlreadyListed) {
        notifyError('NFT is already listed for sale.');
        setLoading(false);
        return;
      }

      const salePrice = ethers.utils.parseUnits(price, 'ether');
      const txResponse = await marketplaceContract.listNFTForSale(tokenId, salePrice);
      await txResponse.wait();
      notifySuccess('NFT listed for sale successfully!');
      await fetchUpdatedData();
      return txResponse;
    } catch (error) {
      notifyError(`Failed to list NFT for sale`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [marketplaceContract, checkAndRequestApproval, notifyError, notifySuccess, fetchUpdatedData, account, isCorrectNetwork]);

  const fetchSalePrice = useCallback(async (tokenId) => {
    try {
      const price = await marketplaceContract.getSalePrice(tokenId);
      return ethers.utils.formatUnits(price, 'ether');
    } catch (error) {
      notifyError(`Failed to fetch sale price: ${error.message}`);
      return null;
    }
  }, [marketplaceContract, notifyError]);

  const cancelSale = useCallback(async (tokenId) => {
    if (!account || !isCorrectNetwork) {
      notifyError('Please connect your wallet and ensure you are on the correct network.');
      return null;
    }
    setLoading(true);
    try {
      const txResponse = await marketplaceContract.cancelSale(tokenId);
      await txResponse.wait();
      notifySuccess('Sale canceled successfully!');
      await fetchUpdatedData();
      return txResponse;
    } catch (error) {
      notifyError(`Failed to cancel sale`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [marketplaceContract, notifyError, notifySuccess, fetchUpdatedData, account, isCorrectNetwork]);

  const fetchHighestOffer = useCallback(async (tokenId) => {
    setLoading(true);
    try {
      const [offerAmount, offerBidder] = await marketplaceContract.getHighestOffer(tokenId);
      if (offerAmount.gt(0) && offerBidder !== ethers.constants.AddressZero) {
        setCurrentOffer({
          tokenId,
          amount: offerAmount,
          bidder: offerBidder,
          isActive: true
        });
      } else {
        setCurrentOffer(null);
      }
    } catch (error) {
      notifyError(`Error fetching offers: ${error.message}`);
      setCurrentOffer(null);
    } finally {
      setLoading(false);
    }
  }, [marketplaceContract, notifyError]);

  const makeOffer = useCallback(async (tokenId, etherAmount) => {
    if (!account || !isCorrectNetwork) {
      notifyError('Please connect your wallet and ensure you are on the correct network.');
      return null;
    }
    if (parseFloat(etherAmount) <= 0) {
      notifyError("Offer amount must be greater than zero.");
      return null;
    }

    setLoading(true);

    try {
      const offerPriceWei = ethers.utils.parseUnits(etherAmount.toString(), 'ether');
      const [highestOfferAmount] = await marketplaceContract.getHighestOffer(tokenId);

      if (offerPriceWei.lte(highestOfferAmount)) {
        notifyError("Please offer more than the current highest offer.");
        setLoading(false);
        return null;
      }

      const txResponse = await marketplaceContract.makeOffer(tokenId, offerPriceWei.toString(), {
        value: offerPriceWei.toString()
      });
      await txResponse.wait();
      notifySuccess('Offer made successfully!');
      await fetchUpdatedData();
      return txResponse;
    } catch (error) {
      if (error.code === 'ACTION_REJECTED') {
        notifyError('Transaction rejected.');
      } else {
        notifyError(`Error making offer`);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [marketplaceContract, notifyError, notifySuccess, fetchUpdatedData, account, isCorrectNetwork]);

  const acceptOffer = useCallback(async (tokenId) => {
    if (!account || !isCorrectNetwork) {
      notifyError('Please connect your wallet and ensure you are on the correct network.');
      return null;
    }
    setLoading(true);
    const approved = await checkAndRequestApproval();
    if (!approved) {
      setLoading(false);
      return null;
    }
    try {
      const txResponse = await marketplaceContract.acceptOffer(tokenId);
      await txResponse.wait();
      notifySuccess('Offer accepted successfully!');
      await fetchUpdatedData();
      return txResponse;
    } catch (error) {
      if (error.code === 'ACTION_REJECTED') {
        notifyError('Transaction rejected.');
      } else {
        notifyError(`Error in transaction`);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [marketplaceContract, checkAndRequestApproval, notifyError, notifySuccess, fetchUpdatedData, account, isCorrectNetwork]);

  const cancelOffer = useCallback(async (tokenId, offerId) => {
    if (!account || !isCorrectNetwork) {
      notifyError('Please connect your wallet and ensure you are on the correct network.');
      return null;
    }
    setLoading(true);
    try {
      const txResponse = await marketplaceContract.cancelOffer(tokenId, offerId);
      await txResponse.wait();
      notifySuccess('Offer canceled successfully!');
      await fetchUpdatedData();
      return txResponse;
    } catch (error) {
      if (error.code === 'ACTION_REJECTED') {
        notifyError('Transaction rejected.');
      } else {
        notifyError(`Failed to cancel offer`);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [marketplaceContract, notifyError, notifySuccess, fetchUpdatedData, account, isCorrectNetwork]);

  const buyNFT = useCallback(async (tokenId) => {
    if (!account || !isCorrectNetwork) {
      notifyError('Please connect your wallet and ensure you are on the correct network.');
      return null;
    }
    setLoading(true);
    try {
      const price = await marketplaceContract.getSalePrice(tokenId);
      if (price.eq(0)) {
        notifyError("This NFT is not currently for sale.");
        setLoading(false);
        return null;
      }

      const txResponse = await marketplaceContract.buyNFT(tokenId, {
        value: price
      });
      await txResponse.wait();
      notifySuccess('NFT purchased successfully!');
      await fetchUpdatedData();
      return txResponse;
    } catch (error) {
      if (error.code === 'ACTION_REJECTED') {
        notifyError('Transaction rejected.');
      } else {
        notifyError(`Error purchasing NFT`);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [marketplaceContract, notifyError, notifySuccess, fetchUpdatedData, account, isCorrectNetwork]);

  const transferNFT = useCallback(async (tokenId, toAddress) => {
    if (!account || !isCorrectNetwork) {
      notifyError('Please connect your wallet and ensure you are on the correct network.');
      return null;
    }
    const approved = await checkAndRequestApproval();
    if (!approved) {
      return null;
    }

    try {
      const signer = provider.getSigner();
      const nftWithSigner = nftContract.connect(signer);
      const tx = await nftWithSigner['safeTransferFrom(address,address,uint256)'](account, toAddress, tokenId);
      await tx.wait();
      notifySuccess("NFT transferred successfully.");
      await fetchUpdatedData();
      return tx;
    } catch (error) {
      if (error.code === 'ACTION_REJECTED') {
        notifyError('Transaction rejected.');
      } else {
        notifyError(`Transfer failed`);
      }
      return null;
    }
  }, [account, nftContract, notifyError, notifySuccess, provider, checkAndRequestApproval, fetchUpdatedData, isCorrectNetwork]);

  const getAllNFTsForSale = useCallback(async () => {
    if (!account || !isCorrectNetwork) {
      notifyError('Please connect your wallet and ensure you are on the correct network.');
      return [];
    }
    try {
      setLoading(true);
      const [tokenIds, prices, sellers] = await marketplaceContract.getAllNFTsForSale();
      const uniqueTokenIds = [...new Set(tokenIds)];
      const uniqueData = uniqueTokenIds.map((tokenId) => {
        const index = tokenIds.indexOf(tokenId);
        return {
          tokenId: tokenId.toString(),
          price: ethers.utils.formatUnits(prices[index].toString(), 'ether'),
          seller: sellers[index]
        };
      });
      setForSaleNFTs(uniqueData);
      return uniqueData;
    } catch (error) {
      notifyError(`Failed to fetch NFTs for sale: ${error.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [marketplaceContract, notifyError, account, isCorrectNetwork]);

  const sortNFTsByPrice = useCallback((order) => {
    setForSaleNFTs((nfts) => {
      const sortedNFTs = [...nfts].sort((a, b) => {
        const priceA = parseFloat(a.price);
        const priceB = parseFloat(b.price);
        return order === 'asc' ? priceA - priceB : priceB - priceA;
      });
      return sortedNFTs;
    });
  }, []);

  return {
    listNFTForSale,
    fetchSalePrice,
    salePrice,
    setSalePrice,
    makeOffer,
    fetchHighestOffer,
    currentOffer,
    acceptOffer,
    cancelOffer,
    cancelSale,
    buyNFT,
    transferNFT,
    getAllNFTsForSale,
    fetchIsListedForSale,
    fetchUpdatedData,
    forSaleNFTs,
    sortNFTsByPrice,
    loading,
    setLoading
  };
};
