import { Injectable } from '@nestjs/common';
import { Connection, Keypair, VersionedTransaction, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

@Injectable()
export class MagicBlockService {
  private readonly API_BASE_URL = 'https://payments.magicblock.app/v1/spl';
  private readonly DEFAULT_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; 
  private readonly EPHEMERAL_RPC = "https://devnet.magicblock.app";

  async preparePrivateTransfer(to: string, amount: number, from: string, memo: string = 'Payroll') {
    const body = {
      from,
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
      memo: memo.substring(0, 20)
    };

    const response = await fetch(`${this.API_BASE_URL}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return await response.json();
  }

  async executePrivateTransfer(to: string, amount: number, privateKeyBase58: string, silent: boolean = false, memo: string = 'Payroll') {
    try {
      const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
      if (!silent) {
        console.log(`🚀 Executing transfer from ${keypair.publicKey.toBase58()} to ${to} for ${amount} USDC`);
      }

      const data = await this.preparePrivateTransfer(to, amount, keypair.publicKey.toBase58(), memo);
      const txBase64 = data.transaction || data.transactionBase64;
      
      if (!txBase64) {
        throw new Error("No transaction object received from MagicBlock.");
      }

      const buf = Buffer.from(txBase64, "base64");
      const sendTo = data.sendTo || 'base';
      const conn = new Connection(sendTo === 'ephemeral' ? this.EPHEMERAL_RPC : "https://api.devnet.solana.com", "confirmed");

      let signedRawTx: Uint8Array;
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
      try {
        const vTx = VersionedTransaction.deserialize(buf);
        vTx.message.recentBlockhash = blockhash;
        vTx.sign([keypair]);
        signedRawTx = vTx.serialize();
      } catch {
        const tx = Transaction.from(buf);
        tx.recentBlockhash = blockhash;
        tx.sign(keypair);
        signedRawTx = tx.serialize();
      }

      const sig = await conn.sendRawTransaction(signedRawTx, { skipPreflight: true });
      
      const confirmation = await conn.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight
      }, "confirmed");

      if (confirmation.value.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
      }

      if (!silent) {
        console.log('\n==========================================');
        console.log('🎉 Transfer Successful!');
        console.log('==========================================');
        console.log(`Amount: ${amount} USDC`);
        console.log(`To: ${to}`);
        console.log(`Signature: ${sig}`);
        console.log(`View on Solscan: https://solscan.io/tx/${sig}?cluster=devnet`);
        console.log('==========================================\n');
      }
      return sig;
    } catch (error) {
      if (!silent) {
        console.error(`❌ Private Transfer Failed for ${to}:`, error instanceof Error ? error.message : error);
      }
      throw error;
    }
  }

  async executeBatchTransfer(transfers: { to: string, amount: number }[], privateKeyBase58: string, memo: string = 'Payroll', onProgress?: (current: number, total: number, msg: string) => void) {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
    const total = transfers.length;

    // Phase 1: Prepare all transactions in parallel
    onProgress?.(0, total, 'Preparing transactions...');
    const preparePromises = transfers.map(async (t) => {
      try {
        const data = await this.preparePrivateTransfer(t.to, t.amount, keypair.publicKey.toBase58(), memo);
        return { ...t, data, status: 'prepared' as const };
      } catch (err: any) {
        return { ...t, error: err.message, status: 'failed' as const };
      }
    });
    const prepared = await Promise.all(preparePromises);

    // Phase 2: Sign and Send all transactions in parallel
    onProgress?.(0, total, 'Broadcasting transactions...');
    const sendPromises = prepared.map(async (p, i) => {
      if (p.status === 'failed') return p;
      try {
        const txBase64 = p.data.transaction || p.data.transactionBase64;
        const buf = Buffer.from(txBase64, "base64");
        const sendTo = p.data.sendTo || 'base';
        const conn = new Connection(sendTo === 'ephemeral' ? this.EPHEMERAL_RPC : "https://api.devnet.solana.com", "confirmed");

        let signedRawTx: Uint8Array;
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
        try {
          const vTx = VersionedTransaction.deserialize(buf);
          vTx.message.recentBlockhash = blockhash;
          vTx.sign([keypair]);
          signedRawTx = vTx.serialize();
        } catch {
          const tx = Transaction.from(buf);
          tx.recentBlockhash = blockhash;
          tx.sign(keypair);
          signedRawTx = tx.serialize();
        }

        const sig = await conn.sendRawTransaction(signedRawTx, { skipPreflight: true });
        onProgress?.(i + 1, total, `Sent: ${sig}`);
        
        const confirmation = await conn.confirmTransaction({
          signature: sig,
          blockhash,
          lastValidBlockHeight
        }, "confirmed");
        
        if (confirmation.value.err) throw new Error(`On-chain error: ${JSON.stringify(confirmation.value.err)}`);
        
        return { ...p, signature: sig, status: 'success' as const };
      } catch (err: any) {
        return { ...p, error: err.message, status: 'failed' as const };
      }
    });

    return await Promise.all(sendPromises);
  }

  async withdraw(owner: string, amount: number, privateKeyBase58: string, mint?: string) {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
    const body = {
      owner: owner || keypair.publicKey.toBase58(),
      mint: mint || this.DEFAULT_MINT,
      amount: Math.floor(amount * 1_000_000),
      idempotent: true,
      cluster: 'devnet'
    };

    const response = await fetch(`${this.API_BASE_URL}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    console.log('Withdraw API Response:', JSON.stringify(data, null, 2));
    const txBase64 = data.transaction || data.transactionBase64;
    
    if (!txBase64) {
      throw new Error("No transaction object received from MagicBlock.");
    }

    const buf = Buffer.from(txBase64, "base64");
    const sendTo = data.sendTo || 'base';
    const conn = new Connection(sendTo === 'ephemeral' ? this.EPHEMERAL_RPC : "https://api.devnet.solana.com", "confirmed");

    let signedRawTx: Uint8Array;
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    
    try {
      const vTx = VersionedTransaction.deserialize(buf);
      vTx.message.recentBlockhash = blockhash;
      vTx.sign([keypair]);
      signedRawTx = vTx.serialize();
    } catch {
      const tx = Transaction.from(buf);
      tx.recentBlockhash = blockhash;
      tx.sign(keypair);
      signedRawTx = tx.serialize();
    }

    const sig = await conn.sendRawTransaction(signedRawTx, { skipPreflight: true });
    await conn.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight
    }, "confirmed");
    return sig;
  }
}
