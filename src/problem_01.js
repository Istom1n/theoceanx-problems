/**
 * Code written by Ivan Istomin, 2018
 */

import createOcean from 'the-ocean-x';
import Web3 from 'web3';
import * as R from 'ramda';
import dotenv from 'dotenv/config';
import {getTime, subHours, format} from 'date-fns';
import CoinAPI from 'coinapi-io';

let position = 'in';
let coinapi = new CoinAPI(process.env.COIN_API);

const update = async() => {
    const provider = new Web3
        .providers
        .HttpProvider(process.env.WEB3_URL);

    let ocean = await createOcean({
        api: {
            key: process.env.OCEAN_API_KEY,
            secret: process.env.OCEAN_API_SECRET,
            baseURL: process.env.BASE_URL
        },
        web3Provider: provider
    });

    // Get first one pair (ZRX/WETH)
    const pairs = await ocean
        .marketData
        .tokenPairs();
    const myPair = pairs[0];

    // Get historical price data for the period of time that we are taking the
    // moving average over (last 5 hours)
    const startTime = parseInt(getTime(subHours(new Date(), 5)) / 1000);
    const endTime = parseInt(getTime(subHours(new Date(), 1)) / 1000);
    const interval = 3600;
    const candlesticks = await ocean
        .marketData
        .candlesticks({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, startTime, endTime, interval});

    // Calculate the moving average for this moment in time.
    const movingAverage = R.mean(R.pluck('close')(candlesticks));

    // Get the last trading price
    const ticker = await ocean
        .marketData
        .ticker({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address});
    const last = ticker.last;

    // Compare the last price to the moving average and change the current position
    // if approriate.
    if (last > movingAverage && position === 'out') {

        // Buy up as much as you can
        const quoteBalance = await ocean
            .wallet
            .getTokenBalance({etherAddress: process.env.BOT_ADDRESS, tokenAddress: myPair.quoteToken.address});

        // This is an approximation of the most we can buy
        const baseAmountToBuy = quoteBalance
            .div(last)
            .times(0.95); // multipliedBy()

        console.log(await ocean.trade.newMarketOrder({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, side: 'buy', orderAmount: baseAmountToBuy, feeOption: 'feeInNative'}));

        position = 'in';
    } else if (position === 'in') {

        // Sell off everything you can
        const baseBalance = await ocean
            .wallet
            .getTokenBalance({etherAddress: process.env.BOT_ADDRESS, tokenAddress: myPair.baseToken.address});
        console.log(await ocean.trade.newMarketOrder({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, side: 'sell', orderAmount: baseBalance, feeOption: 'feeInNative'}));

        position = 'out';
    }

    /*
     * Run update function once per hour
     *
     * NB:
     * From StackOverflow: setTimeout() ensures that timer events don't "stack" if they're
     * left unprocessed. In some circumstances a whole load of setInterval events can arrive
     * immediately after each other without any delay. (c) Alnitak
     */
    setTimeout(update, 3600 * 1000);
}

const check_api = async() => {
    let last_5_hrs = await coinapi.ohlcv_historic_data('POLONIEX_SPOT_ZRX_BTC', '1HRS', subHours(new Date(), 6), new Date());
    console.log(last_5_hrs);
}

// update();
check_api();
