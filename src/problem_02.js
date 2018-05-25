/**
 * Code written by Ivan Istomin, 2018
 */

import createOcean from 'the-ocean-x';
import Web3 from 'web3';
import * as R from 'ramda';
import dotenv from 'dotenv/config';
import {getTime, subDays} from 'date-fns';
import CoinAPI from 'coinapi-io';

let position = 'out';
let direction = 'short';

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

    const pairs = await ocean
        .marketData
        .tokenPairs();
    const myPair = pairs[0];

    // Get historical price data for the period of time that we are taking the
    // moving average over
    const startTime = parseInt(getTime(subHours(new Date(), 5)) / 1000);
    const endTime = parseInt(getTime(subHours(new Date(), 1)) / 1000);
    const interval = 3600;

    const candlesticks = await ocean
        .marketData
        .candlesticks({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, startTime, endTime, interval})

    // Calculate the moving average for this moment in time
    const movingAverage = R.mean(R.pluck('close')(candlesticks));

    // Calculate the variance and standard deviation for this moment in time
    const variance = R.mean(R.map(x => (parseFloat(x) - movingAverage) ** 2, R.pluck('close')(candlesticks)));
    const stdDev = Math.sqrt(variance);

    // Set risk tolerence levels
    const PositionBand = stdDev;
    const StopLossLevel = 2 * PositionBand;

    // Get the last trading price
    const ticker = await ocean
        .marketData
        .ticker({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address});
    const last = ticker.last;

    // Compare if last price is overvalued and too high away from the average - in
    // this case, want to sell aka go short
    if (last > movingAverage + PositionBand && position === 'out') {
        const quoteBalance = await ocean
            .wallet
            .getTokenBalance({etherAddress: process.env.BOT_ADDRESS, tokenAddress: myPair.quoteToken.address});

        // Approximation for maximum amount can trade
        const baseAmount = quoteBalance
            .div(last)
            .times(0.95);

        console.log(await ocean.trade.newMarketOrder({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, side: 'sell', orderAmount: baseAmount, feeOption: 'feeInNative'}));
        position = 'in';
        direction = 'short';
    }

    // Compare if last price is undervalued and too low away from the average - in
    // this case, want to buy aka go long
    if (last < movingAverage - PositionBand && position === 'out') {
        const quoteBalance = await ocean
            .wallet
            .getTokenBalance({etherAddress: process.env.BOT_ADDRESS, tokenAddress: myPair.quoteToken.address})

        const baseAmount = quoteBalance
            .div(last)
            .times(0.95);

        console.log(await ocean.trade.newMarketOrder({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, side: 'buy', orderAmount: baseAmount, feeOption: 'feeInNative'}));
        position = 'in';
        direction = 'long';
    }

    // Exit clause if currently in short position
    if (direction === 'short') {
        // Short price has mean reverted and can take profit on position
        if (last < movingAverage && position === 'in') {
            const quoteBalance = await ocean
                .wallet
                .getTokenBalance({etherAddress: process.env.BOT_ADDRESS, tokenAddress: myPair.quoteToken.address})

            const baseAmount = quoteBalance
                .div(last)
                .times(0.95);

            console.log(await ocean.trade.newMarketOrder({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, side: 'buy', orderAmount: baseAmount, feeOption: 'feeInNative'}));
            position = 'out';
            direction = 'none';
        }
        // Short price has gone even higher from mean and can need to stop loss on
        // position
        if (last > movingAverage + StopLossLevel && position === 'in') {
            const quoteBalance = await ocean
                .wallet
                .getTokenBalance({etherAddress: process.env.BOT_ADDRESS, tokenAddress: myPair.quoteToken.address})

            const baseAmount = quoteBalance
                .div(last)
                .times(0.95);

            console.log(await ocean.trade.newMarketOrder({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, side: 'buy', orderAmount: baseAmount, feeOption: 'feeInNative'}));
            position = 'out';
            direction = 'none';
        }
    }

    // Exit clause if currently in long position
    if (direction === 'long') {
        // Long price has mean reverted and can take profit on position
        if (last > movingAverage && position === 'in') {
            const quoteBalance = await ocean
                .wallet
                .getTokenBalance({etherAddress: process.env.BOT_ADDRESS, tokenAddress: myPair.quoteToken.address})

            const baseAmount = quoteBalance
                .div(last)
                .times(0.95)

            console.log(await ocean.trade.newMarketOrder({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, side: 'sell', orderAmount: baseAmount, feeOption: 'feeInNative'}));
            position = 'out'
            direction = 'none'
        }

        // Long price has gone even lower from mean and need to stop loss on position
        if (last < movingAverage - StopLossLevel && position === 'in') {
            const quoteBalance = await ocean
                .wallet
                .getTokenBalance({etherAddress: process.env.BOT_ADDRESS, tokenAddress: myPair.quoteToken.address})

            const baseAmount = quoteBalance
                .div(last)
                .times(0.95);

            console.log(await ocean.trade.newMarketOrder({baseTokenAddress: myPair.baseToken.address, quoteTokenAddress: myPair.quoteToken.address, side: 'sell', orderAmount: baseAmount, feeOption: 'feeInNative'}));
            position = 'out';
            direction = 'none';
        }
    }

    // Run update function once per hour
    setTimeout(update, 3600 * 1000);
}

// Run
update();