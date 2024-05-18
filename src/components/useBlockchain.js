import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import nftContractABI from '../contractABI.json';
import marketContractABI from '../marketContractABI.json';
import { toast } from 'react-toastify';

const NFT_CONTRACT_ADDRESS = '0xA4F77aE2f6E33d1F4B6470BfAbF0fbD924525De1';
const MARKET_CONTRACT_ADDRESS = '0x5F98cFE4d71F4D8cCad7bEF4B15b7906cb954464';
const MAGMA_TESTNET_CHAIN_ID = 6969696969;

export const useBlockchain = () => {
  const [account, setAccount] = useState(null);
  const [metadata, setMetadata] = useState({});
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [forSaleNFTs, setForSaleNFTs] = useState([]);
  const [recentlySoldNFTs, setRecentlySoldNFTs] = useState([]);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentNFTs, setCurrentNFTs] = useState([]);
  const [displayNFTs, setDisplayNFTs] = useState([]);
  const [section, setSection] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const provider = useMemo(() => new ethers.providers.Web3Provider(window.ethereum), []);
  const nftContract = useMemo(() => new ethers.Contract(NFT_CONTRACT_ADDRESS, nftContractABI, provider), [provider]);
  const marketContract = useMemo(() => new ethers.Contract(MARKET_CONTRACT_ADDRESS, marketContractABI, provider), [provider]);

  const notifySuccess = useCallback((message, id) => toast.success(message, { toastId: id }), []);
  const notifyError = useCallback((message, id) => toast.error(message, { toastId: id }), []);

  const checkNetwork = useCallback(async () => {
    try {
      const network = await provider.getNetwork();
      const isCorrectChain = network.chainId === MAGMA_TESTNET_CHAIN_ID;
      setIsCorrectNetwork(isCorrectChain);
      if (!isCorrectChain) {
        throw new Error('Incorrect network. Please switch to the Magma Testnet.');
      }
    } catch (networkError) {
      console.error('Error checking network:', networkError);
      notifyError(networkError.message, 'networkError');
      setIsCorrectNetwork(false);
    }
  }, [provider, notifyError]);

  const connectWalletHandler = useCallback(async () => {
    setLoading(true);
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        notifySuccess('Wallet connected successfully!', 'walletConnect');
        checkNetwork();
      } catch (connectError) {
        notifyError(`Error connecting to wallet: ${connectError.message}`, 'connectError');
        console.error('Error connecting to wallet:', connectError);
      } finally {
        setLoading(false);
      }
    } else {
      notifyError("Please install MetaMask!", 'installMetaMask');
      setLoading(false);
    }
  }, [notifySuccess, checkNetwork, notifyError]);

  const fetchMetadata = useCallback(async (tokenId) => {
    const id = tokenId.toString();
    if (metadata[id]) {
      return metadata[id];
    }
    try {
      const metadataUrl = `https://ipfs.io/ipfs/bafybeidbx5abzyox7x6wdyeqgajvcgyovyvkiubkdapdomy464wfeuetnu/${id}.json`;
      const response = await fetch(metadataUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const metadataJson = await response.json();
      const owner = await nftContract.ownerOf(id);
      const newMetadata = { ...metadataJson, owner };

      setMetadata(prev => ({ ...prev, [id]: newMetadata }));
      return newMetadata;
    } catch (metadataError) {
      console.error(`Error fetching metadata for tokenId ${id}:`, metadataError);
      notifyError(`Error fetching metadata for tokenId ${id}: ${metadataError.message}`, `metadataError_${id}`);
      return null;
    }
  }, [metadata, setMetadata, nftContract, notifyError]);

  const addUniqueNFTs = useCallback((nfts) => {
    setCurrentNFTs(prev => {
      const uniqueNFTs = [...new Map([...prev, ...nfts].map(nft => [nft.tokenId, nft])).values()];
      if (uniqueNFTs.length !== prev.length || JSON.stringify(uniqueNFTs) !== JSON.stringify(prev)) {
        return uniqueNFTs;
      }
      return prev;
    });
  }, []);

  const loadBlockchainData = useCallback(async () => {
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      await checkNetwork();

      const [ownedTokens] = await Promise.all([
        nftContract.getTokenIdsOwnedBy(address)
      ]);

      const ownedNFTs = ownedTokens.map(tokenId => tokenId.toString());
      setOwnedNFTs(ownedNFTs);

      const metadataPromises = ownedNFTs.map(fetchMetadata);
      const metadataResults = await Promise.all(metadataPromises);
      const validNFTs = ownedNFTs.map((tokenId, index) => ({
        tokenId,
        metadata: metadataResults[index]
      })).filter(nft => nft.metadata);

      addUniqueNFTs(validNFTs);
    } catch (loadDataError) {
      console.error('Error loading blockchain data:', loadDataError);
      setError(`Failed to load blockchain data: ${loadDataError.message}`);
      notifyError(`Error encountered: ${loadDataError.message}`, 'loadDataError');
      if (loadDataError.message.includes("Incorrect network")) {
        notifyError("You're on the wrong network. Please switch to the Magma Testnet.", 'networkError');
      }
    } finally {
      setLoading(false);
    }
  }, [provider, nftContract, notifyError, fetchMetadata, addUniqueNFTs, checkNetwork]);

  const fetchAllNFTs = useCallback(async () => {
    setLoading(true);
    try {
      const totalSupply = await nftContract.totalSupply();
      const tokenIds = Array.from({ length: totalSupply.toNumber() }, (_, i) => (i + 1).toString());

      const metadataPromises = tokenIds.map(fetchMetadata);
      const metadataResults = await Promise.all(metadataPromises);
      const validNFTs = tokenIds.map((tokenId, index) => ({
        tokenId,
        metadata: metadataResults[index]
      })).filter(nft => nft.metadata);

      const ownerPromises = validNFTs.map(async (nft) => {
        const owner = await nftContract.ownerOf(nft.tokenId);
        const isOwner = owner.toLowerCase() === account.toLowerCase();
        return { ...nft, isOwner };
      });

      const nftsWithOwnership = await Promise.all(ownerPromises);
      addUniqueNFTs(nftsWithOwnership);
    } catch (fetchAllNFTsError) {
      console.error("Failed to fetch NFTs:", fetchAllNFTsError);
      notifyError(`Failed to fetch NFTs: ${fetchAllNFTsError.message}`, 'fetchAllNFTsError');
    } finally {
      setLoading(false);
    }
  }, [nftContract, fetchMetadata, account, addUniqueNFTs, notifyError]);

  const fetchOwnedNFTs = useCallback(async () => {
    if (account && nftContract) {
      try {
        const tokens = await nftContract.getTokenIdsOwnedBy(account);
        return tokens.map(tokenId => ({ tokenId: tokenId.toString(), isOwner: true, isListedForSale: false }));
      } catch (fetchOwnedError) {
        console.error('Error fetching owned NFTs:', fetchOwnedError);
        notifyError('Failed to fetch owned NFTs', 'fetchOwnedError');
        return []; // Return an empty array on error
      }
    }
  }, [account, nftContract, notifyError]);

  const transferNFT = useCallback(async (tokenId, toAddress) => {
    if (!account || !nftContract) {
      notifyError("Wallet or NFT Contract not available.", 'transferNFTError');
      return null;
    }

    try {
      const signer = provider.getSigner();
      const nftWithSigner = nftContract.connect(signer);
      const tx = await nftWithSigner['safeTransferFrom(address,address,uint256)'](account, toAddress, tokenId);
      await tx.wait();
      notifySuccess("NFT transferred successfully.", 'transferNFTSuccess');
      await fetchOwnedNFTs(); // Ensure the state is updated after transfer
      return tx;
    } catch (transferNFTError) {
      console.error('Transfer NFT failed:', transferNFTError);
      notifyError(`Transfer failed: ${transferNFTError.message}`, 'transferNFTError');
      return null;
    }
  }, [account, nftContract, notifyError, notifySuccess, provider, fetchOwnedNFTs]);

  const fetchForSaleNFTs = useCallback(async () => {
    setLoading(true);
    if (!marketContract) {
      console.error('Market Contract not loaded');
      setLoading(false);
      return;
    }
    try {
      const [tokenIds, prices, sellers] = await marketContract.getAllNFTsForSale();
      if (!tokenIds.length) {
        setForSaleNFTs([]);
        setLoading(false);
        console.log('No NFTs currently for sale');
        return;
      }
      const saleNFTs = tokenIds.map((tokenId, index) => ({
        tokenId: tokenId.toString(),
        price: ethers.utils.formatEther(prices[index].toString()),
        seller: sellers[index]
      }));

      const metadataPromises = saleNFTs.map(nft => fetchMetadata(nft.tokenId));
      const metadataResults = await Promise.all(metadataPromises);
      const validNFTs = saleNFTs.map((nft, index) => ({
        ...nft,
        metadata: metadataResults[index]
      })).filter(nft => nft.metadata);

      addUniqueNFTs(validNFTs);
      setForSaleNFTs(validNFTs);
    } catch (fetchForSaleError) {
      console.error('Error fetching NFTs for sale:', fetchForSaleError);
      notifyError(`Failed to fetch NFTs for sale: ${fetchForSaleError.message}`, 'fetchForSaleError');
    } finally {
      setLoading(false);
    }
  }, [marketContract, notifyError, fetchMetadata, addUniqueNFTs]);

  const fetchRecentlySoldNFTs = useCallback(async () => {
    setLoading(true);
    try {
      const allTokens = await marketContract.getAllNFTsForSale();
      const soldTokens = allTokens.filter(token => !token.isListed);
      if (soldTokens.length === 0) {
        toast.info('No recently sold NFTs found.');
        setLoading(false);
        return [];
      }
      const metadataPromises = soldTokens.map(nft => fetchMetadata(nft.tokenId));
      const metadataResults = await Promise.all(metadataPromises);
      const validNFTs = soldTokens.map((nft, index) => ({
        ...nft,
        metadata: metadataResults[index]
      })).filter(nft => nft.metadata);

      setRecentlySoldNFTs(validNFTs);
      return validNFTs;
    } catch (error) {
      console.error('Error fetching recently sold NFTs:', error);
      notifyError(`Failed to fetch recently sold NFTs: ${error.message}`, 'fetchRecentlySoldError');
      return [];
    } finally {
      setLoading(false);
    }
  }, [marketContract, fetchMetadata, notifyError]);

  useEffect(() => {
    if (window.ethereum && !account && !loading) {
      loadBlockchainData();
    }
  }, [account, loadBlockchainData, loading]);

  useEffect(() => {
    const handleNetworkChange = (newChainId) => {
      const networkId = parseInt(newChainId, 16);
      console.log(`Network changed to ${networkId}`);
      setIsCorrectNetwork(networkId === MAGMA_TESTNET_CHAIN_ID);
    };

    window.ethereum.on('chainChanged', handleNetworkChange);

    return () => {
      window.ethereum.removeListener('chainChanged', handleNetworkChange);
    };
  }, []);

  useEffect(() => {
    if (account && isCorrectNetwork) {
      switch (section) {
        case 'owned':
          if (!ownedNFTs.length) {
            fetchOwnedNFTs();
          }
          break;
        case 'sale':
          if (!forSaleNFTs.length) {
            fetchForSaleNFTs();
          }
          break;
        case 'recentlySold':
          if (!recentlySoldNFTs.length) {
            fetchRecentlySoldNFTs();
          }
          break;
        default:
          console.log('No action needed for the current section.');
      }
    }
  }, [account, isCorrectNetwork, section, ownedNFTs, forSaleNFTs, recentlySoldNFTs, fetchOwnedNFTs, fetchForSaleNFTs, fetchRecentlySoldNFTs]);

  useEffect(() => {
    const contract = new ethers.Contract(MARKET_CONTRACT_ADDRESS, marketContractABI, provider.getSigner());
    const saleCancelledHandler = (tokenId, seller) => {
      setForSaleNFTs(currentNFTs => currentNFTs.filter(nft => nft.tokenId !== tokenId));
      // Remove or comment out the following line to prevent the redundant toast message
      // toast.info(`Sale cancelled for token ${tokenId}`, { toastId: `cancelSale_${tokenId}` });
    };

    contract.on("NFTSaleCancelled", saleCancelledHandler);

    return () => {
      contract.off("NFTSaleCancelled", saleCancelledHandler);
    };
  }, [setForSaleNFTs, provider]);

  useEffect(() => {
    if (!Array.isArray(currentNFTs)) {
      console.error("currentNFTs is not an array", currentNFTs);
      setCurrentNFTs([]);  // Reset to empty array if corrupted
    }
  }, [currentNFTs]);

  return {
    account,
    connectWalletHandler,
    error,
    ownedNFTs,
    forSaleNFTs,
    recentlySoldNFTs,
    currentNFTs,
    displayNFTs,
    setCurrentNFTs,
    setDisplayNFTs,
    metadata,
    isCorrectNetwork,
    notifySuccess,
    notifyError,
    fetchAllNFTs,
    fetchForSaleNFTs,
    fetchOwnedNFTs,
    fetchRecentlySoldNFTs,
    fetchMetadata,
    loading,
    setLoading,
    transferNFT,
    setSection,
    setCurrentPage,
    section,
    currentPage,
    nftContract,
    NFT_CONTRACT_ADDRESS,
    MARKET_CONTRACT_ADDRESS
  };
};
