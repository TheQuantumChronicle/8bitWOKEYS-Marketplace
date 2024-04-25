import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import contractABI from './contractABI.json';
import './App.css';

function App() {
    const [account, setAccount] = useState(null);
    const [nftTokens, setNFTTokens] = useState([]);
    const [metadata, setMetadata] = useState({});
    const [numberOfTokens, setNumberOfTokens] = useState(1);
    const [totalMintedTokens, setTotalMintedTokens] = useState(0);
    const [isMinting, setIsMinting] = useState(false);
    const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

    const CONTRACT_ADDRESS = '0xA4F77aE2f6E33d1F4B6470BfAbF0fbD924525De1';
    const MAGMA_TESTNET_CHAIN_ID = 6969696969;

    const notifySuccess = (message) => toast.success(message);
    const notifyError = (message) => toast.error(message);

    useEffect(() => {
        document.title = "8bit Wokeys"; // Set the title for your app
    }, []);

    const checkNetwork = useCallback(async () => {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const { chainId } = await provider.getNetwork();
        setIsCorrectNetwork(chainId === MAGMA_TESTNET_CHAIN_ID);
    }, []);

    const loadBlockchainData = useCallback(async () => {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await checkNetwork();
            const signer = provider.getSigner();
            const address = await signer.getAddress();
            setAccount(address);

            const nftContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
            const ownedTokens = await nftContract.getTokenIdsOwnedBy(address);
            setNFTTokens(ownedTokens.map(tokenId => tokenId.toString()));

            const totalSupply = await nftContract.totalSupply();
            setTotalMintedTokens(parseInt(totalSupply));
        } catch (error) {
            console.error('Error loading blockchain data:', error);
        }
    }, [checkNetwork]);

    const fetchMetadata = useCallback(async (tokenId) => {
        try {
            const metadataUrl = `https://ipfs.io/ipfs/bafybeidbx5abzyox7x6wdyeqgajvcgyovyvkiubkdapdomy464wfeuetnu/${tokenId}.json`;
            const response = await fetch(metadataUrl);
            const metadata = await response.json();
            setMetadata(prevMetadata => ({
                ...prevMetadata,
                [tokenId]: metadata
            }));
        } catch (error) {
            console.error('Error fetching metadata:', error);
        }
    }, []);

    useEffect(() => {
        loadBlockchainData();
        window.ethereum.on('chainChanged', (chainId) => {
            setIsCorrectNetwork(parseInt(chainId, 16) === MAGMA_TESTNET_CHAIN_ID);
            window.location.reload();
        });

        return () => {
            window.ethereum.removeListener('chainChanged', checkNetwork);
        };
    }, [loadBlockchainData, checkNetwork]);

    useEffect(() => {
        nftTokens.forEach(tokenId => fetchMetadata(tokenId));
    }, [nftTokens, fetchMetadata]);

    const connectWalletHandler = async () => {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        try {
          // Request account access
          await provider.send("eth_requestAccounts", []);
          const signer = provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);
        } catch (error) {
          notifyError('Could not connect to wallet.');
          console.error(error);
        }
    };

    const handleMint = async (numberOfTokens) => {
        setIsMinting(true);
        try {
            if (nftTokens.length + numberOfTokens > 5) {
                throw new Error('You have reached the maximum limit of NFTs allowed.');
            }
    
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            // Check if the provider is connected properly
            await provider.send("eth_chainId", []);
            
            const signer = provider.getSigner();
            const nftContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
            const price = ethers.utils.parseEther('0.1'); // Price per NFT in LAVA
            const totalPrice = price.mul(numberOfTokens);
    
            const txResponse = await nftContract.mintNFT(numberOfTokens, { value: totalPrice });
            await txResponse.wait();
    
            const ownedTokens = await nftContract.getTokenIdsOwnedBy(account);
            setNFTTokens(ownedTokens.map(tokenId => tokenId.toString()));
            notifySuccess('Mint successful!');
        } catch (error) {
            console.error('Minting failed:');
            // Checking if the error is network-related
            if(error.message.includes("network")) {
                notifyError('Minting failed due to network error. Please check your connection and try again.');
            } else {
                notifyError(`Minting failed`);
            }
        } finally {
            setIsMinting(false);
        }
    };

    function TwitterShareButton() {
        const tweetText = encodeURIComponent(`Did you get your 8bit WOKEY on the Magma testnet?!\n\nI did!\n\nGet yours at 8bitwokeys . com`);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
    
        return (
            <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="twitter-share-button">
                Share on X
            </a>
        );
    }    

    return (
        <div className="App">
            <ToastContainer
                position="top-center"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
            {isMinting && (
                <div className="overlay">
                    <div className="loader"></div>
                </div>
            )}
            <header className="App-header">
                <h1 className="title">8bit  WOKEYS</h1>
            </header>
            {/* Conditionally render the hero image and certain containers based on whether NFTs are present */}
            {nftTokens.length === 0 && (
                <div className="hero-image-container">
                    <img src="/hero.png" alt="8bit WOKEYS Hero" className="hero-image" />
                </div>
            )}
            <div className="main-content">
                {isCorrectNetwork ? (
                    <>
                        {!account ? (
                            <button onClick={connectWalletHandler} className="button">Connect Wallet</button>
                        ) : (
                            <p className="account-info"><strong>Wallet Account: {account}</strong></p>
                        )}
                        <p className="total-nfts"><b>Total NFTs: 1000</b></p>
                        <p className="total-mints"><b>Minted: {totalMintedTokens}</b></p>
                        <p className="max-mints-info"><b>Max Mints Per Wallet: 5</b></p>
                        <p className="mint-price-info"><strong>Price Per NFT: .1 LAVA</strong></p>
                        <p className="contract-info"><strong>Contract Address: {CONTRACT_ADDRESS}</strong></p>
                        <select value={numberOfTokens} onChange={(e) => setNumberOfTokens(parseInt(e.target.value))} className="select">
                            {[1,2,3,4,5].map(num => <option key={num} value={num}>{num}</option>)}
                        </select>
                        <button className="button" onClick={() => handleMint(numberOfTokens)} disabled={numberOfTokens === 0 || isMinting}>
                            {isMinting ? (
                                <div className="loading-dots">
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                                </div>
                            ) : (
                                'Mint'
                            )}
                        </button>
                        <div>
                            <h3>Your NFTs:</h3>
                            <div className="nft-list">
                                {nftTokens.length === 0 ? (
                                    <div className="no-nfts-container">
                                        <p className="no-nfts">No NFTs owned yet</p>
                                    </div>
                                ) : (
                                    nftTokens.map((tokenId) => (
                                        <div key={tokenId} className="nft-item">
                                            <a href={`https://magmascan.org/token/${CONTRACT_ADDRESS}/instance/${tokenId}`} target="_blank" rel="noopener noreferrer">
                                                <img src={`https://ipfs.io/ipfs/bafybeiab76pyx2vmpyg3q7sb22pjqanf37buxfzv7xov4esr2wfavfdgcu/${tokenId}.png`} alt="" className="nft-image"/>
                                            </a>
                                            {metadata[tokenId] && (
                                                <div className="metadata">
                                                    <h4 className="metadata-title">8 Bit WOKEY {tokenId}</h4>
                                                    <ul className="metadata-list">
                                                        <li>Name: {metadata[tokenId].name}</li>
                                                        <li>Description: {metadata[tokenId].description}</li>
                                                        <li>Attributes:</li>
                                                        <ul className="attributes-list">
                                                            {metadata[tokenId].attributes.map((attribute, index) => (
                                                                <li key={index}>
                                                                    {attribute.trait_type}: {attribute.value}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </ul>
                                                    <TwitterShareButton tokenId={tokenId} metadata={metadata} />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="footer-links">
                                <p><b>Built By Magma Makers, For Magma Makers</b></p>
                                <span className="link-separator"> | </span>
                                <a href="https://twitter.com/i/communities/1766007547775873227"><strong>Join Magma Makers</strong></a>
                                <span className="link-separator"> | </span>
                                <a href="https://docs.magma.foundation/" target="_blank" rel="noopener noreferrer"><strong>Magma Docs</strong></a>
                                <span className="link-separator"> | </span>
                                <a href="https://www.magma.foundation/" target="_blank" rel="noopener noreferrer"><strong>Magma Foundation Website</strong></a>
                            </div>
                        </div>
                    </>
                ) : (
                    <p>Please connect to the Magma testnet to use this application.</p>
                )}
            </div>
        </div>
    );
}

export default App;
