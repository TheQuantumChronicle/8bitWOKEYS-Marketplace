import React, { useMemo } from 'react';
import NFTItem from './NFTItem';
import Pagination from './Pagination';

const NFTList = ({ nfts, loading, account, makeOffer, transferNFT, listNFTForSale, cancelSale, buyNFT, currentPage, nftsPerPage, paginate, totalNfts }) => {
  const memoizedNFTItems = useMemo(() => {
    return nfts.map((nft, index) => (
      <NFTItem
        key={`${nft.tokenId}-${index}-${nft.metadata?.name || 'default'}-${nft.isListedForSale ? 'listed' : 'unlisted'}`} // Ensure unique key
        tokenId={nft.tokenId}
        metadata={nft.metadata}
        price={nft.price}
        isListedForSale={nft.isListedForSale}
        isOwner={account === (nft.metadata && nft.metadata.owner)}
        account={account}
        makeOffer={makeOffer}
        buyNFT={buyNFT}
        listNFTForSale={listNFTForSale}
        cancelSale={cancelSale}
        transferNFT={transferNFT}
        loading={nft.loading}
      />
    ));
  }, [nfts, account, makeOffer, buyNFT, listNFTForSale, cancelSale, transferNFT]);

  if (loading && (!nfts || nfts.length === 0)) {
    return <p>Loading...</p>;
  }

  if (!nfts || nfts.length === 0) {
    return <div className="no-nfts-container"><p>No NFTs found</p></div>;
  }

  return (
    <div className="nft-list">
      {totalNfts > nftsPerPage && (
        <Pagination nftsPerPage={nftsPerPage} totalNfts={totalNfts} paginate={paginate} currentPage={currentPage} />
      )}
      {memoizedNFTItems}
      {totalNfts > nftsPerPage && (
        <Pagination nftsPerPage={nftsPerPage} totalNfts={totalNfts} paginate={paginate} currentPage={currentPage} />
      )}
    </div>
  );
};

export default React.memo(NFTList);
