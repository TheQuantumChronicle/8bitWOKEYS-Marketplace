import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify';
import ConnectWallet from './components/ConnectWallet';
import Header from './components/Header';
import NFTList from './components/NFTList';
import Footer from './components/Footer';
import ToastContainerComponent from './components/ToastContainerComponent';
import { useBlockchain } from './components/useBlockchain';
import { useMarketplace } from './components/useMarketplace';
import './App.css';
import Pagination from './components/Pagination';

function App() {
  const {
    account,
    isCorrectNetwork,
    connectWalletHandler,
    fetchOwnedNFTs,
    fetchMetadata,
    nftContract,
    transferNFT,
    notifyError,
    currentNFTs,
    setDisplayNFTs,
    loading,
    setLoading,
    setCurrentNFTs,
  } = useBlockchain();

  const { 
    fetchIsListedForSale, 
    getAllNFTsForSale, 
    listNFTForSale, 
    cancelSale, 
    makeOffer, 
    buyNFT
  } = useMarketplace();

  const [currentPage, setCurrentPage] = useState(1);
  const [nftsPerPage] = useState(25);
  const fetchController = useRef(null);

  const displayedNFTs = useMemo(() => {
    const startIndex = (currentPage - 1) * nftsPerPage;
    return currentNFTs.slice(startIndex, startIndex + nftsPerPage);
  }, [currentNFTs, currentPage, nftsPerPage]);

  useEffect(() => {
    setDisplayNFTs(displayedNFTs);
  }, [displayedNFTs, setDisplayNFTs]);

  useEffect(() => {
    document.title = "8bit Wokeys Marketplace";
  }, []);

  const handlePagination = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
  }, []);

  const cancelOngoingFetch = () => {
    if (fetchController.current) {
      fetchController.current.abort();
    }
  };

  const handleShowAllNFTs = useCallback(async () => {
    cancelOngoingFetch();
    if (!isCorrectNetwork) {
      notifyError('Incorrect network. Please switch to the Magma Testnet.');
      return;
    }
    if (!account) {
      notifyError('Please connect your wallet.');
      return;
    }
    setLoading(true);
    fetchController.current = new AbortController();
    const signal = fetchController.current.signal;
    try {
      const totalSupply = await nftContract.totalSupply();
      const allMetadataPromises = [];
      const initialNFTs = [];
      for (let i = 1; i <= totalSupply.toNumber(); i++) {
        const tokenId = i.toString();
        initialNFTs.push({ tokenId, loading: true });
        allMetadataPromises.push(fetchMetadata(tokenId, { signal }));
      }
      setCurrentNFTs(initialNFTs);
      setDisplayNFTs(initialNFTs);
      
      const allMetadata = await Promise.all(allMetadataPromises);
      const validMetadata = allMetadata.filter(md => md);

      const listingStatusPromises = validMetadata.map((_, index) => fetchIsListedForSale((index + 1).toString()));
      const listingStatuses = await Promise.all(listingStatusPromises);

      const newNFTs = validMetadata.map((metadata, index) => {
        const tokenId = (index + 1).toString();
        const { isListed, salePrice } = listingStatuses[index];
        const isOwner = metadata.owner === account;
        return {
          tokenId,
          metadata,
          isListedForSale: isListed,
          price: salePrice,
          isOwner,
          canMakeOffer: !isOwner,
          loading: false
        };
      });

      setCurrentNFTs(newNFTs);
      setDisplayNFTs(newNFTs);
    } catch (error) {
      if (error.name !== 'AbortError') {
        notifyError(`Error loading all NFTs: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchMetadata, setLoading, nftContract, fetchIsListedForSale, notifyError, setCurrentNFTs, setDisplayNFTs, account, isCorrectNetwork]);

  const handleShowForSaleNFTs = useCallback(async () => {
    cancelOngoingFetch();
    if (!isCorrectNetwork) {
      notifyError('Incorrect network. Please switch to the Magma Testnet.');
      return;
    }
    if (!account) {
      notifyError('Please connect your wallet.');
      return;
    }
    setLoading(true);
    fetchController.current = new AbortController();
    const signal = fetchController.current.signal;
    try {
      const forSaleNFTs = await getAllNFTsForSale();
      if (!forSaleNFTs || forSaleNFTs.length === 0) {
        toast.info('No NFTs for sale.');
        setLoading(false);
        return;
      }
      const initialNFTs = forSaleNFTs.map(nft => ({ tokenId: nft.tokenId, loading: true }));
      setCurrentNFTs(initialNFTs);
      setDisplayNFTs(initialNFTs);

      const fetchMetadataPromises = forSaleNFTs.map(nft => fetchMetadata(nft.tokenId, { signal }));
      const fetchedMetadata = await Promise.all(fetchMetadataPromises);
      const nfts = forSaleNFTs.map((nft, index) => ({
        tokenId: nft.tokenId,
        price: nft.price,
        metadata: fetchedMetadata[index],
        isOwner: fetchedMetadata[index]?.owner === account,
        isListedForSale: true,
        canMakeOffer: fetchedMetadata[index]?.owner !== account,
        loading: false
      }));
      setCurrentNFTs(nfts);
      setDisplayNFTs(nfts);
      handlePagination(1);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching for-sale NFTs:', error);
        toast.error('Failed to fetch NFTs for sale.');
      }
    } finally {
      setLoading(false);
    }
  }, [getAllNFTsForSale, fetchMetadata, account, handlePagination, setLoading, setDisplayNFTs, setCurrentNFTs, isCorrectNetwork, notifyError]);

  const handleShowOwnedNFTs = useCallback(async () => {
    cancelOngoingFetch();
    if (!isCorrectNetwork) {
      notifyError('Incorrect network. Please switch to the Magma Testnet.');
      return;
    }
    if (!account) {
      notifyError('Please connect your wallet.');
      return;
    }
    setLoading(true);
    fetchController.current = new AbortController();
    const signal = fetchController.current.signal;
    try {
      const ownedNFTIds = await fetchOwnedNFTs();
      if (!ownedNFTIds.length) {
        toast.info('No owned NFTs found.');
        setCurrentNFTs([]);
        setDisplayNFTs([]);
        setLoading(false);
        return;
      }
      const initialNFTs = ownedNFTIds.map(nft => ({ tokenId: nft.tokenId, loading: true }));
      setCurrentNFTs(initialNFTs);
      setDisplayNFTs(initialNFTs);

      const fetchMetadataPromises = ownedNFTIds.map(nft => fetchMetadata(nft.tokenId, { signal }));
      const fetchedMetadata = await Promise.all(fetchMetadataPromises);
      const listedResults = await Promise.all(ownedNFTIds.map(nft => fetchIsListedForSale(nft.tokenId)));
      const nfts = ownedNFTIds.map((nft, index) => ({
        tokenId: nft.tokenId,
        isOwner: true,
        isListedForSale: listedResults[index].isListed,
        price: listedResults[index].salePrice,
        metadata: fetchedMetadata[index],
        loading: false
      }));
      setCurrentNFTs(nfts);
      setDisplayNFTs(nfts);
      handlePagination(1);
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast.error(`Failed to fetch owned NFTs: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchOwnedNFTs, account, fetchMetadata, fetchIsListedForSale, handlePagination, setCurrentNFTs, setDisplayNFTs, setLoading, isCorrectNetwork, notifyError]);

  useEffect(() => {
    if (window.ethereum && !account && !loading) {
      connectWalletHandler();
    }
  }, [account, connectWalletHandler, loading]);

  if (!isCorrectNetwork && account) {
    return (
      <div className="network-error">
        <p>You're on the wrong network. Please connect to the Magma Testnet to use this application.</p>
      </div>
    );
  }

  return (
    <div className="App">
      <ToastContainerComponent />
      <Header />
      {!account && (
        <div className="hero-image-container">
          <img src="/hero.png" alt="Hero" className="hero-image" />
        </div>
      )}
      <ConnectWallet />
      {account && (
        <>
          {currentNFTs.length > nftsPerPage && (
            <Pagination
              nftsPerPage={nftsPerPage}
              totalNfts={currentNFTs.length}
              paginate={handlePagination}
              currentPage={currentPage}
            />
          )}
          <div className="filter-buttons">
            <button onClick={handleShowAllNFTs}>Show All NFTs</button>
            <button onClick={handleShowForSaleNFTs}>Show NFTs For Sale</button>
            <button onClick={handleShowOwnedNFTs}>Show Owned NFTs</button>
          </div>
          <NFTList
            nfts={displayedNFTs}
            loading={loading}
            account={account}
            makeOffer={makeOffer}
            transferNFT={transferNFT}
            listNFTForSale={listNFTForSale}
            cancelSale={cancelSale}
            buyNFT={buyNFT}
          />
          {currentNFTs.length > nftsPerPage && (
            <Pagination
              nftsPerPage={nftsPerPage}
              totalNfts={currentNFTs.length}
              paginate={handlePagination}
              currentPage={currentPage}
            />
          )}
        </>
      )}
      <Footer />
    </div>
  );
}

export default App;