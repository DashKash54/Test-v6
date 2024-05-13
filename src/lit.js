import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { ethers } from 'ethers';
import {
    LitActionResource,
    LitAccessControlConditionResource,
    generateAuthSig,
    createSiweMessageWithRecaps,
    LitPKPResource,
} from '@lit-protocol/auth-helpers';
import {
    AuthCallbackParams,
    AuthSig,
    LitAbility,
    LitResourceAbilityRequest,
} from '@lit-protocol/types';

class Lit {
    litNodeClient;
    chain = "ethereum";
    wallet;

    constructor() {
        this.litNodeClient = new LitJsSdk.LitNodeClient({
            litNetwork: "cayenne",
        });
        this.wallet = ethers.Wallet.createRandom();
    }

    async connect() {
        await this.litNodeClient.connect();
    }

    async getAuthSig() {
        const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain: this.chain });
        console.log(authSig);
        return authSig;
    }

    async getPKPSessionSigs() {
        // let nonce = await litNodeClient.getLatestBlockhash();

        // const authNeededCallback = async ({ chain, resources, expiration, uri }) => {
        //     const domain = "localhost:3000";
        //     const message = new SiweMessage({
        //         domain,
        //         address: wallet.address,
        //         statement: "Sign a session key to use with Lit Protocol",
        //         uri,
        //         version: "1",
        //         chainId: "1",
        //         expirationTime: expiration,
        //         resources,
        //         nonce,
        //     });
        //     const toSign = message.prepareMessage();
        //     const signature = await wallet.signMessage(toSign);

        //     const authSig = {
        //         sig: signature,
        //         derivedVia: "web3.eth.personal.sign",
        //         signedMessage: toSign,
        //         address: wallet.address,
        //     };

        //     return authSig;
        // };

        const pkpSessionSigs = await this.litNodeClient.getPkpSessionSigs({
            pkpPublicKey: "0x048097284853ce1a788fec360ee3c552a542e808450769dbca86cca32b23abc42f888e8e706dbff8af0a59208efbb41d0e17b5c679c81e2e227c405a17a3fc6bf1",
            authMethods: [await this.getAuthSig()],
            resourceAbilityRequests: [
                {
                  resource: new LitPKPResource('*'),
                  ability: LitAbility.PKPSigning,
                },],
        
            // -- only add this for manzano network
            // ...(devEnv.litNodeClient.config.litNetwork === LitNetwork.Manzano
            //   ? { capacityDelegationAuthSig: devEnv.superCapacityDelegationAuthSig }
            //   : {}),
          });

        return pkpSessionSigs;
    }

    async encrypt(sessionSigs) {
        const accessControlConditions = [
            {
              contractAddress: '',
              standardContractType: '',
              chain: this.chain,
              method: 'eth_getBalance',
              parameters: [
                ':userAddress',
                'latest'
              ],
              returnValueTest: {
                comparator: '>=',
                value: '0'
              }
            }
        ];
        console.log(sessionSigs);
        const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
            {
              accessControlConditions,
              sessionSigs,
              chain: this.chain,
              dataToEncrypt: "this is a secret message",
            },
            this.litNodeClient
        );

        const litActionCode = `
            const go = async () => {
                console.log("hi");
                console.log("authSig");
                console.log(authSig);
                // const sigShare = await Lit.Actions.signEcdsa({ toSign, publicKey, sigName });
                const apiKey = await Lit.Actions.decryptAndCombine({
                    accessControlConditions,
                    ciphertext,
                    dataToEncryptHash,
                    authSig,
                    chain: 'ethereum',
                  });
                  console.log('apiKey');
                  console.log(apiKey);
            };

            go();
        `;

        const authSig = await this.getAuthSig();
        console.log(authSig);
        const signatures = await this.litNodeClient.executeJs({
            code: litActionCode,
            sessionSigs,
            jsParams: {
                // toSign: [84, 104, 105, 115, 32, 109, 101, 115, 115, 97, 103, 101, 32, 105, 115, 32, 101, 120, 97, 99, 116, 108, 121, 32, 51, 50, 32, 98, 121, 116, 101, 115],
                // publicKey: mintInfo.pkp.publicKey,
                // sigName: "sig1",
                ciphertext,
                dataToEncryptHash,
                accessControlConditions,
                authSig,
            },
        });

        // const decryptedString = await LitJsSdk.decryptToString(
        //     {
        //       accessControlConditions,
        //       ciphertext,
        //       dataToEncryptHash,
        //       sessionSigs,
        //       chain: "ethereum",
        //     },
        //     this.litNodeClient
        // );
        // console.log(decryptedString);
    }

    async litActions(sessionSigs) {
    }

    async getSessionSigs() {
        const resourceAbilityRequests = [
            // {
            // resource: new LitAccessControlConditionResource('*'),
            // ability: LitAbility.AccessControlConditionDecryption,
            // },
            {
            resource: new LitActionResource('*'),
            ability: LitAbility.LitActionExecution,
            },
        ];

        const ONE_WEEK_FROM_NOW = new Date(
            Date.now() + 1000 * 60 * 60 * 24 * 70
        ).toISOString();

        const sessionSigs = await this.litNodeClient.getSessionSigs({
            chain: this.chain,
            resourceAbilityRequests,
            authNeededCallback: async ({
                uri,
                expiration,
                resourceAbilityRequests,
            }) => {
                console.log('resourceAbilityRequests:', resourceAbilityRequests);
                console.log('uri:', uri);
                console.log('expiration:', expiration);

                if (!expiration) {
                    throw new Error('expiration is required');
                }

                if (!resourceAbilityRequests) {
                    throw new Error('resourceAbilityRequests is required');
                }

                if (!uri) {
                    throw new Error('uri is required');
                }

                const toSign = await createSiweMessageWithRecaps({
                    uri,
                    expiration: ONE_WEEK_FROM_NOW,
                    resources: resourceAbilityRequests,
                    walletAddress: this.wallet.address,
                    nonce: await this.litNodeClient.getLatestBlockhash(),
                    litNodeClient: this.litNodeClient,
                });

                const authSig = await generateAuthSig({
                    signer: this.wallet,
                    toSign,
                });
            
                return authSig;
            },
        });

        console.log(sessionSigs);
        console.log(this.wallet);
        return sessionSigs;
    }
}

export default new Lit();