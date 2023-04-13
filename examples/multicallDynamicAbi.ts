// import { AbiCall, Call, multicallDynamicAbi , multicallDynamicAbiIndexedCalls } from '@defifofum/multicall';
import { AbiCall, Call, multicallDynamicAbi, multicallDynamicAbiIndexedCalls } from '../dist/index'
import { getDefaultProvider, utils } from 'ethers'

const RPC_PROVIDER = 'https://bsc-dataseed.binance.org/';

const ABIs = {
    getStakeTokenFeeBalance: [utils.Fragment.from(
        {
            "inputs": [],
            "name": "getStakeTokenFeeBalance",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    )],
    totalSupply: [utils.Fragment.from(
        {
            "inputs": [],
            "name": "totalSupply",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    )],
}


const calls: Call[] = [
    {
        functionName: 'getStakeTokenFeeBalance',
        address: '0x5798271B134e27c4dE28CB33aa8D18e5753e83fC',
        params: []
    },
    {
        functionName: 'totalSupply',
        address: '0x603c7f932ED1fc6575303D8Fb018fDCBb0f39a95',
        params: []
    },
    {
        functionName: 'getStakeTokenFeeBalance',
        address: '0x6FbB19A87f1E86f027A084C8bfc3528120Cf8249',
        params: []
    },
    {
        functionName: 'totalSupply',
        address: '0xdDb3Bd8645775F59496c821E4F55A7eA6A6dc299',
        params: []
    },
    {
        functionName: 'getStakeTokenFeeBalance',
        address: '0x7124d635a4bb82319acfd57ce9da18137a7a6f22',
        params: []
    },
    {
        functionName: 'totalSupply',
        address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        params: []
    },
    {
        functionName: 'getStakeTokenFeeBalance',
        address: '0xEedd7475Eb5D05D591bE0927B178AcBBdC5ee1c1',
        params: []
    },
    {
        functionName: 'totalSupply',
        address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        params: []
    },
    {
        functionName: 'getStakeTokenFeeBalance',
        address: '0x48ee3f7748fac3e8e4858bd0b09483c4339d3d7e',
        params: []
    },
    {
        functionName: 'totalSupply',
        address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
        params: []
    },
]

async function runExampleMulticallDynamicAbi() {
    let expandedCalls: Call[] = [];
    for (let index = 0; index < 500; index++) {
        expandedCalls = [...expandedCalls, ...calls];
    }

    // setup multicall
    // AbiCall[]
    const callDataArray: any[] = [];
    for (const call of expandedCalls) {
        callDataArray.push({
            address: call.address,
            functionName: call.functionName,
            params: call.params,
            abi: ABIs[call.functionName]
        });
    }
    let data: {
        address: string;
        bscscanUrl: string;
        functionName: string;
        returnValue: string;
        tx: string;
    }[] = [];
    // send multicall data
    if (callDataArray.length) {
        // Can pass in the direct RPC_PROVIDER url as well
        const provider = getDefaultProvider(RPC_PROVIDER);
        // multicallDynamicAbi(rpcUrl: string, calls: AbiCall[], maxCallsPerTx = 1000)
        // const returnedData = await multicallDynamicAbi(provider, callDataArray);
        const returnedData = (await multicallDynamicAbiIndexedCalls(provider, [callDataArray]))[0];
        // Pull addresses out of return data
        data = returnedData.map((dataArray, index) => {
            return {
                address: expandedCalls[index].address,
                bscscanUrl: `https://bscscan.com/address/${expandedCalls[index].address}#readContract`,
                functionName: expandedCalls[index].functionName,
                // Values are returned as an array for each return value. We are pulling out the singular balance variable here
                returnValue: dataArray[0].toString(),
                tx: ''
            }
        });
    }

    console.dir(data);
    console.log(`Total calls: ${expandedCalls.length}.`);
}

async function timeScript(script: any) {
    const start = new Date();
    await script();
    const scriptTime = new Date() as any - Number(start);
    console.log(`Script took ${scriptTime} ms to run.`)
}

(async function () {
    try {
        await timeScript(runExampleMulticallDynamicAbi);
        process.exit(0);
    } catch (e) {
        console.error(`Error running example script:`)
        console.dir(e);
        process.exit(1);
    }
}());

