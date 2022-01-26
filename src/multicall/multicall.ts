import { getDefaultProvider, providers } from 'ethers'
import { Interface, Fragment } from '@ethersproject/abi'
import { Contract } from '@ethersproject/contracts'
import { chunkArray } from '../utils';
import { multicallContracts } from '../config'

import MulticallBuild from './Multicall.json'

export interface Call {
    address: string // Address of the contract
    functionName: string // Function name on the contract (example: balanceOf)
    params?: any[] // Function params
}

/**
 * Batch multiple calls to contracts with the same abi to reduce rpc calls and increase response time. 
 * 
 * @param rpcUrl Url of RPC endpoint to make the call to
 * @param abi abi generated from the contract code 
 * @param calls Array of Call objects to run through multicall
 * @param maxCallsPerTx (default 1000) limit the number of calls per multicall call 
 * @returns Array of array of return values from each call. Index 0 is the first return value and so on.
 */
export async function multicall(
    rpcUrl: string,
    abi: any[],
    calls: Call[],
    maxCallsPerTx = 1000
): Promise<any[][] | undefined> {
    // setup provider
    const provider = getDefaultProvider(rpcUrl);

    const { chainId } = await provider.getNetwork();
    const multicallAddress = multicallContracts[chainId];

    if (multicallAddress == undefined) {
        // No contract deployed for chainId
        throw new Error(`No multicall defined for chainId ${chainId}.`);
    }
    // setup contracts
    const multicallContract = new Contract(multicallAddress, MulticallBuild.abi, provider);
    const itf = new Interface(abi);
    // chunk calls to prevent RPC overflow
    const chunkedCalls = chunkArray(calls, maxCallsPerTx);
    // Process calls
    let finalData: any[] = []
    for (const currentCalls of chunkedCalls) {
        const calldata = currentCalls.map((call) => [call.address.toLowerCase(), itf.encodeFunctionData(call.functionName, call.params)])
        const { returnData } = await multicallContract.callStatic.aggregate(calldata);
        const res = returnData.map((data: any, i: number) => itf.decodeFunctionResult(currentCalls[i].functionName, data))
        finalData = [...finalData, ...res];
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
 * @param options Optional parameter to set the options of the multicall 
 * @param options.maxCallsPerTx (default 1000) limit the number of calls per multicall call 
 * @param options.chainId Pass the chainId of the network to limit an extra RPC call
 * @returns Array of array of return values from each call. Index 0 is the first return value and so on.
 */
export async function multicallDynamicAbi(
    provider: string | providers.BaseProvider | providers.JsonRpcProvider,
    calls: AbiCall[],
    options: {
        maxCallsPerTx: number;
        chainId?: number;
    } = {
            maxCallsPerTx: 1000
        }
): Promise<any[][] | undefined> {
    // setup provider
    const currentProvider = typeof provider == 'string' ? getDefaultProvider(provider) : provider;

    let currentChainId = options.chainId;
    if (!currentChainId) {
        const { chainId: returnedChainId } = await currentProvider.getNetwork();
        currentChainId = returnedChainId;
    }

    const multicallAddress = multicallContracts[currentChainId];

    if (multicallAddress == undefined) {
        // No contract deployed for chainId
        throw new Error(`No multicall defined for chainId ${currentChainId}.`);
    }
    // setup contracts
    const multicallContract = new Contract(multicallAddress, MulticallBuild.abi, currentProvider);
    // chunk calls to prevent RPC overflow
    const chunkedCalls = chunkArray(calls, options.maxCallsPerTx);
    // Process calls
    let finalData: any[] = [];
    for (let index = 0; index < chunkedCalls.length; index++) {
        const currentCalls = chunkedCalls[index];
        const currentInterfaces = currentCalls.map((currentCall) => new Interface(currentCall.abi));
        const calldata = currentCalls.map((call, i) => [call.address.toLowerCase(), currentInterfaces[i].encodeFunctionData(call.functionName, call.params)]);
        const { returnData } = await multicallContract.callStatic.aggregate(calldata);
        const res = returnData.map((data: any, i: number) => currentInterfaces[i].decodeFunctionResult(currentCalls[i].functionName, data));
        finalData = [...finalData, ...res];
    }

    return finalData
}

/**
 * Batch multiple calls to contracts with the same abi to reduce rpc calls and increase response time. 
 * 
 * @param provider Ethers provider or Url of RPC endpoint to make the call to
 * @param indexedCalls Array of Array of AbiCall. Return values match the shape of this array
 * @param options Optional parameter to set the options of the multicall 
 * @param options.maxCallsPerTx (default 1000) limit the number of calls per multicall call 
 * @param options.chainId Pass the chainId of the network to limit an extra RPC call
 * @returns Array of array of return values from each call. Index 0 is the first return value and so on.
 */
export async function multicallDynamicAbiIndexedCalls(
    provider: string | providers.BaseProvider | providers.JsonRpcProvider,
    indexedCalls: AbiCall[][],
    options: {
        maxCallsPerTx?: number;
        chainId?: number;
    } = {
        maxCallsPerTx: 1000
    }
): Promise<any[][] | any[]> {
    const allCalls = indexedCalls.reduce((aggregatedCalls, currentCalls) => [...aggregatedCalls, ...currentCalls]);
    const multicallData = await multicallDynamicAbi(provider, allCalls, { 
        maxCallsPerTx: options.maxCallsPerTx, 
        chainId: options.chainId
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