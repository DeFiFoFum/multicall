import { getDefaultProvider, providers } from 'ethers'
import { Interface, Fragment } from '@ethersproject/abi'
import { Contract } from '@ethersproject/contracts'
import { chunkArray } from '../utils';
import { multicallContracts } from '../config'

import MulticallBuild from './Multicall.json'

export type BlockTag = number | 'latest' | 'earliest' | 'pending';

/**
 * Configurable options for multicall calls
 * maxCallsPerTx (default 1000) - The number of calls to batch in a single multicall tx
 * chainId (optional) - Pass the chainId to avoid needing to make an extra call to the provider to obtain it
 * blockTag (optional) - Use multicall at an earlier blocknumber 
 * customMulticallAddress (optional) - Pass in a user defined multicall contract to use. If using an archive node, 
 *      the multicall contracts in this repo may have been deployed AFTER the data you are looking for.
 * tryAggregate (optional) - Set this option to `true` to skip over failed calls
 */
export interface MultiCallOptions {
    maxCallsPerTx?: number;
    chainId?: number;
    tryAggregate?: boolean;
    blockTag?: BlockTag;
    customMulticallAddress?: string;
}

export interface Call {
    address: string // Address of the contract
    functionName: string // Function name on the contract (example: balanceOf)
    params?: any[] // Function params
}

/**
 * Batch multiple calls to contracts with the same abi to reduce rpc calls and increase response time. 
 * 
 * @param provider Ethers provider or Url of RPC endpoint to make the call to
 * @param abi abi generated from the contract code 
 * @param calls Array of Call objects to run through multicall
 * @param MultiCallOptions See MultiCallOptions interface for details on configurable options 
 * @returns Array of array of return values from each call. Index 0 is the first return value and so on.
 */
export async function multicall(
    provider: string | providers.BaseProvider | providers.JsonRpcProvider,
    abi: (any | Fragment)[], // Abi of the call to make 
    calls: Call[],
    { maxCallsPerTx = 1000, blockTag = 'latest', tryAggregate = false, chainId, customMulticallAddress }: MultiCallOptions = {}
): Promise<any[][] | undefined> {
    // setup provider
    const currentProvider = typeof provider == 'string' ? getDefaultProvider(provider) : provider;

    let currentChainId = chainId;
    if (!currentChainId) {
        const { chainId: returnedChainId } = await currentProvider.getNetwork();
        currentChainId = returnedChainId;
    }

    const multicallAddress = customMulticallAddress ? customMulticallAddress : multicallContracts[currentChainId];

    if (multicallAddress == undefined) {
        // No contract deployed for chainId
        throw new Error(`No multicall defined for chainId ${currentChainId}.`);
    }
    // setup contracts
    const multicallContract = new Contract(multicallAddress, MulticallBuild.abi, currentProvider);
    const itf = new Interface(abi);
    // chunk calls to prevent RPC overflow
    const chunkedCalls = chunkArray(calls, maxCallsPerTx);
    // Process calls
    let finalData: any[] = []
    for (const currentCalls of chunkedCalls) {
        const calldata = currentCalls.map((call) => [call.address.toLowerCase(), itf.encodeFunctionData(call.functionName, call.params)])

        let parsedData;
        if(tryAggregate) {
            const returnData: {success: boolean, returnData: string}[] = await multicallContract.callStatic.tryAggregate(false, calldata, { blockTag });
            parsedData = returnData.map((data, i: number) => {
                if(data.success) {
                    return itf.decodeFunctionResult(currentCalls[i].functionName, data.returnData)
                } else {
                    return undefined
                } 
            });
        } else {
            const { returnData } = await multicallContract.callStatic.aggregate(calldata, { blockTag });
            parsedData = returnData.map((data: any, i: number) => {
                return itf.decodeFunctionResult(currentCalls[i].functionName, data)
            })
        }
        finalData = [...finalData, ...parsedData];
    }

    return finalData
}

export interface AbiCall {
    address: string // Address of the contract
    functionName: string // Function name on the contract (example: balanceOf)
    params?: any[] // Function params
    abi: (any | Fragment)[] // Abi of the call to make 
}


/**
 * Batch multiple calls to contracts with the same abi to reduce rpc calls and increase response time. 
 * 
 * @param provider Ethers provider or Url of RPC endpoint to make the call to
 * @param calls Array of AbiCall objects to run through multicall
 * @param MultiCallOptions See MultiCallOptions interface for details on configurable options 
 * @returns Array of array of return values from each call. Index 0 is the first return value and so on.
 */
export async function multicallDynamicAbi(
    provider: string | providers.BaseProvider | providers.JsonRpcProvider,
    calls: AbiCall[],
    { maxCallsPerTx = 1000, blockTag = 'latest', tryAggregate = false, chainId, customMulticallAddress }: MultiCallOptions = {}
): Promise<any[][] | undefined> {
    // setup provider
    const currentProvider = typeof provider == 'string' ? getDefaultProvider(provider) : provider;

    let currentChainId = chainId;
    if (!currentChainId) {
        const { chainId: returnedChainId } = await currentProvider.getNetwork();
        currentChainId = returnedChainId;
    }

    const multicallAddress = customMulticallAddress ? customMulticallAddress : multicallContracts[currentChainId];

    if (multicallAddress == undefined) {
        // No contract deployed for chainId
        throw new Error(`No multicall defined for chainId ${currentChainId}.`);
    }
    // setup contracts
    const multicallContract = new Contract(multicallAddress, MulticallBuild.abi, currentProvider);
    // chunk calls to prevent RPC overflow
    const chunkedCalls = chunkArray(calls, maxCallsPerTx);
    // Process calls
    let finalData: any[] = [];
    for (let index = 0; index < chunkedCalls.length; index++) {
        const currentCalls = chunkedCalls[index];
        const currentInterfaces = currentCalls.map((currentCall) => new Interface(currentCall.abi));
        const calldata = currentCalls.map((call, i) => [call.address.toLowerCase(), currentInterfaces[i].encodeFunctionData(call.functionName, call.params)]);

        let parsedData;
        if(tryAggregate) {
            const returnData: {success: boolean, returnData: string}[] = await multicallContract.callStatic.tryAggregate(false, calldata, { blockTag });
            parsedData = returnData.map((data, i: number) => {
                if(data.success) {
                    return currentInterfaces[i].decodeFunctionResult(currentCalls[i].functionName, data.returnData)
                } else {
                    return undefined
                } 
            });
        } else {
            const { returnData } = await multicallContract.callStatic.aggregate(calldata, { blockTag });
            parsedData = returnData.map((data: any, i: number) => {
                return currentInterfaces[i].decodeFunctionResult(currentCalls[i].functionName, data)
            });
        }
        finalData = [...finalData, ...parsedData];
    }

    return finalData
}

/**
 * Batch multiple calls to contracts with the same abi to reduce rpc calls and increase response time. 
 * 
 * @param provider Ethers provider or Url of RPC endpoint to make the call to
 * @param indexedCalls Array of Array of AbiCall. Return values match the shape of this array
 * @param MultiCallOptions See MultiCallOptions interface for details on configurable options 
 * @returns Array of array of return values from each call. Index 0 is the first return value and so on.
 */
export async function multicallDynamicAbiIndexedCalls(
    provider: string | providers.BaseProvider | providers.JsonRpcProvider,
    indexedCalls: AbiCall[][],
    { maxCallsPerTx = 1000, blockTag = 'latest', tryAggregate = false, chainId, customMulticallAddress }: MultiCallOptions = {}
): Promise<any[][] | any[]> {
    // setup provider
    const currentProvider = typeof provider == 'string' ? getDefaultProvider(provider) : provider;

    let currentChainId = chainId;
    if (!currentChainId) {
        const { chainId: returnedChainId } = await currentProvider.getNetwork();
        currentChainId = returnedChainId;
    }

    const allCalls = indexedCalls.reduce((aggregatedCalls, currentCalls) => [...aggregatedCalls, ...currentCalls]);
    const multicallData = await multicallDynamicAbi(currentProvider, allCalls, {
        maxCallsPerTx,
        chainId: currentChainId,
        tryAggregate,
        blockTag,
        customMulticallAddress,
    });

    let returnData = [];
    let nextIndex = 0;
    for await (const calls of indexedCalls) {
        const endIndex = nextIndex + calls.length;
        // nextIndex is inclusive, endIndex is exclusive
        returnData.push(multicallData.slice(nextIndex, endIndex));
        nextIndex = endIndex;
    }
    return returnData;
}