/**
 * Code written by Ivan Istomin, 2018
 */

import createOcean from 'the-ocean-x';
import Web3 from 'web3';
import dotenv from 'dotenv/config';

(async() => {

    // Create web3 provider to be passed during instantiation
    const provider = new Web3
        .providers
        .HttpProvider(process.env.WEB3_URL);

    // Create The Ocean X API instance variable with our credentials and a web3
    let ocean = await createOcean({
        api: {
            key: process.env.OCEAN_API_KEY,
            secret: process.env.OCEAN_API_SECRET,
            baseURL: process.env.BASE_URL
        },
        web3Provider: provider
    });

    //Get all tradeable token pairs on The Ocean X.
    const pairs = await ocean
        .marketData
        .tokenPairs();

    // Get first one pair (ZRX/WETH)
    const myPair = pairs[0];

    // Log this pair to console
    console.log('Trading on pair: ', myPair.baseToken.symbol + '/' + myPair.quoteToken.symbol);

    // Write params for Order creation
    const data = {
        baseTokenAddress: myPair.baseToken.address,
        quoteTokenAddress: myPair.quoteToken.address,
        side: 'buy',
        orderAmount: '1',
        feeOption: 'feeInNative'
    };

    // Make Order and log it
    console.log('Market order result: ', await ocean.trade.newMarketOrder(data));
})().catch(err => {
    // Catch errors
    console.log(err);
});