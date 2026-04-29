const { Keypair } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const { getAuthToken } = require('@magicblock-labs/ephemeral-rollups-sdk');

async function test() {
  const kp = Keypair.generate();
  const signMessage = async (msg) => nacl.sign.detached(msg, kp.secretKey);
  const token = await getAuthToken("https://devnet.magicblock.app", kp.publicKey, signMessage);
  console.log("Token:", token);
}
test().catch(console.error);
