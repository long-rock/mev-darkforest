import { BigNumber, PopulatedTransaction, providers, utils, Wallet } from "ethers";
import { NETWORK_ID } from "@darkforest_eth/contracts";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
  FlashbotsTransaction,
} from "@flashbots/ethers-provider-bundle";
import { List, Repeat } from "immutable";
import { useState } from "preact/hooks";

export function usePrivateKey(): string {
  // @ts-expect-error
  const privateKey: string = df.getPrivateKey();
  return privateKey;
}

export function useProvider(): providers.JsonRpcProvider {
  return new providers.JsonRpcProvider({ url: "https://rpc-df.xdaichain.com/" }, NETWORK_ID);
}

export function useWallet(): Wallet {
  const provider = useProvider();
  const privateKey = usePrivateKey();
  return new Wallet(privateKey, provider);
}

interface BundleTransaction {
  transaction: PopulatedTransaction;
  to: string;
  gasLimit?: BigNumber;
  gasPrice?: BigNumber;
}

export interface FlashbotsResultSubmitting {
  status: "submitting";
}

export interface FlashbotsResultSubmitted {
  status: "submitted";
  targetBlock: number;
  transaction: FlashbotsTransaction;
}

export interface FlashbotsResultIncluded {
  status: "included";
  targetBlock: number;
  transaction: FlashbotsTransaction;
}

export interface FlashbotsResultBlockPassedWithoutInclusion {
  status: "block_passed_without_inclusion";
  targetBlock: number;
  transaction: FlashbotsTransaction;
}

export interface FlashbotsResultNonceTooHigh {
  status: "nonce_too_high";
  targetBlock: number;
  transaction: FlashbotsTransaction;
}

export interface FlashbotsResultSkip {
  status: "skip";
  targetBlock: number;
  transaction: FlashbotsTransaction;
}

export type FlashbotsResult =
  | FlashbotsResultSubmitting
  | FlashbotsResultSubmitted
  | FlashbotsResultIncluded
  | FlashbotsResultBlockPassedWithoutInclusion
  | FlashbotsResultNonceTooHigh
  | FlashbotsResultSkip;

interface FlashbotsArgs {
  blocks?: number;
  onComplete?: () => void;
}

interface FlashbotsBundle {
  submitBundle: (transactions: BundleTransaction[]) => void;
  clear: () => void;
  bundles: FlashbotsResult[];
  submitting: boolean;
  completed: boolean;
  error: string | undefined;
}

export function useFlashbotsBundle({ onComplete, blocks = 20 }: FlashbotsArgs = {}): FlashbotsBundle {
  const provider = useProvider();
  const wallet = useWallet();
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [bundles, setBundles] = useState<FlashbotsResult[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  const clear = () => {
    setError(undefined);
    setSubmitting(false);
    setBundles([]);
  };

  const setErrorAndComplete = (error: string) => {
    setError(error);
    onComplete && onComplete();
  };

  const submitBundle = async (transactions: BundleTransaction[]) => {
    clear();
    setSubmitting(true);
    const initState: FlashbotsResultSubmitting = { status: "submitting" };
    setBundles(Repeat(initState, blocks).toArray());

    // TODO(fra): using the same wallet as the tx signer is not recommended.
    // so what to do?
    let flashbotsProvider;
    try {
      flashbotsProvider = await FlashbotsBundleProvider.create(provider, wallet, "https://xdai-relay.nethermind.io/");
    } catch (err) {
      console.error(err);
      return setErrorAndComplete("Could not create Flashbots bundle provider");
    }

    let nonce;
    try {
      nonce = await provider.getTransactionCount(wallet.address);
    } catch (err) {
      console.error(err);
      return setErrorAndComplete("Could not retrieve nonce");
    }

    const bundle = [];
    // TODO(fra): get gas price from df config?
    const defaultGasPrice = utils.parseUnits("2", "gwei");
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      let gasLimit = BigNumber.from("0");
      if (tx.gasLimit) {
        gasLimit = tx.gasLimit;
      } else {
        try {
          gasLimit = await provider.estimateGas(tx.transaction);
        } catch (err) {
          console.error(err);
          return setErrorAndComplete("Could not estimate gas limit");
        }
      }

      const transaction = {
        to: tx.to,
        data: tx.transaction.data,
        chainId: NETWORK_ID,
        nonce: nonce + i,
        gasPrice: tx.gasPrice ?? defaultGasPrice,
        gasLimit,
      };
      bundle.push({ transaction, signer: wallet });
    }

    let signedTransactions;
    try {
      signedTransactions = await flashbotsProvider.signBundle(bundle);
    } catch (err) {
      console.error(err);
      return setErrorAndComplete("Could not sign bundle");
    }

    let currentBlock;
    try {
      currentBlock = await provider.getBlockNumber();
    } catch (err) {
      console.error(err);
      return setErrorAndComplete("Could not get current block");
    }

    const newBundles = [];
    for (let i = 0; i < blocks; i++) {
      const targetBlock = currentBlock + i;
      try {
        const bundleSubmission = await flashbotsProvider.sendRawBundle(signedTransactions, targetBlock);
        const localStatus: FlashbotsResult = {
          status: "submitted",
          targetBlock,
          transaction: bundleSubmission,
        };
        newBundles.push(localStatus);
      } catch (err) {
        console.error(err);
        return setErrorAndComplete("Could not send bundle");
      }
    }
    setBundles(newBundles);

    // check status of submissions
    let immutableBundles = List.of(...newBundles);
    let included = false;
    for (let i = 0; i < blocks; i++) {
      const localStatus = immutableBundles.get(i);
      console.log(`Checking status ${i}`, localStatus);
      if (included) {
        if (localStatus) {
          const newLocalStatus: FlashbotsResult = {
            status: "skip",
            targetBlock: localStatus.targetBlock,
            transaction: localStatus.transaction,
          };
          if (newLocalStatus) {
            immutableBundles = immutableBundles.set(i, newLocalStatus);
            setBundles(immutableBundles.toArray());
          }
        }
      } else {
        if (localStatus?.status === "submitted") {
          try {
            const response = await localStatus.transaction.wait();
            console.log(`Response ${FlashbotsBundleResolution[response]} ${localStatus.targetBlock}`);
            let newLocalStatus: FlashbotsResult | undefined;
            if (response == FlashbotsBundleResolution.AccountNonceTooHigh) {
              newLocalStatus = {
                status: "nonce_too_high",
                targetBlock: localStatus.targetBlock,
                transaction: localStatus.transaction,
              };
            } else if (response == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
              newLocalStatus = {
                status: "block_passed_without_inclusion",
                targetBlock: localStatus.targetBlock,
                transaction: localStatus.transaction,
              };
            } else {
              included = true;
              newLocalStatus = {
                status: "included",
                targetBlock: localStatus.targetBlock,
                transaction: localStatus.transaction,
              };
            }

            if (newLocalStatus) {
              immutableBundles = immutableBundles.set(i, newLocalStatus);
              setBundles(immutableBundles.toArray());
            }
          } catch (err) {
            console.error(err);
            return setErrorAndComplete("Could not await bundle result");
          }
        }
      }
    }

    setCompleted(true);
    onComplete && onComplete();
  };

  return {
    submitBundle,
    clear,
    bundles,
    submitting,
    completed,
    error,
  };
}
