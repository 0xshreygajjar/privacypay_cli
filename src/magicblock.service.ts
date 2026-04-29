import { Injectable } from '@nestjs/common';
import { Connection, Keypair, VersionedTransaction, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

@Injectable()
export class MagicBlockService {
  private readonly API_BASE_URL = 'https://payments.magicblock.app/v1/spl';
  private readonly DEFAULT_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; 
  private readonly EPHEMERAL_RPC = "https://devnet.magicblock.app";

  async executePrivateTransfer(to: string, amount: number, privateKeyBase58: string) {
    try {
      const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
      console.log(`🚀 Executing transfer from ${keypair.publicKey.toBase58()} to ${to} for ${amount} USDC`);

      const body = {
        from: keypair.publicKey.toBase58(),
        to,
        mint: this.DEFAULT_MINT,
        amount: Math.floor(amount * 1_000_000),
        cluster: 'devnet',
        visibility: 'private',
        fromBalance: 'base',
        toBalance: 'ephemeral',
        initIfMissing: true,
        initAtasIfMissing: true,
        initVaultIfMissing: true,
        idempotent: true,
        memo: 'MagicBlock CLI Private Transfer'
      };

      const response = await fetch(`${this.API_BASE_URL}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const txBase64 = data.transaction || data.transactionBase64;
      
      if (!txBase64) {
        throw new Error("No transaction object received from MagicBlock.");
      }

      const buf = Buffer.from(txBase64, "base64");
      const sendTo = data.sendTo || 'base';
      const conn = new Connection(sendTo === 'ephemeral' ? this.EPHEMERAL_RPC : "https://api.devnet.solana.com", "confirmed");

      let signedRawTx: Uint8Array;
      try {
        const vTx = VersionedTransaction.deserialize(buf);
        vTx.sign([keypair]);
        signedRawTx = vTx.serialize();
      } catch {
        const tx = Transaction.from(buf);
        tx.sign(keypair);
        signedRawTx = tx.serialize();
      }

      const sig = await conn.sendRawTransaction(signedRawTx, { skipPreflight: true });
      const confirmation = await conn.confirmTransaction(sig, "confirmed");

      if (confirmation.value.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('\n==========================================');
      console.log('🎉 Transfer Successful!');
      console.log('==========================================');
      console.log(`Amount: ${amount} USDC`);
      console.log(`To: ${to}`);
      console.log(`Signature: ${sig}`);
      console.log(`View on Solscan: https://solscan.io/tx/${sig}?cluster=devnet`);
      console.log('==========================================\n');
      return sig;
    } catch (error) {
      console.error(`❌ Private Transfer Failed for ${to}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
