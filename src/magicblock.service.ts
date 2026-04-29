import { Injectable } from '@nestjs/common';
import { Connection, Keypair, VersionedTransaction, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

@Injectable()
export class MagicBlockService {
  private readonly API_BASE_URL = 'https://payments.magicblock.app/v1/spl';
  private readonly MINTS = {
    devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  };

  private getMint(cluster: string): string {
    return cluster === 'mainnet' ? this.MINTS.mainnet : this.MINTS.devnet;
  }

  private decodeKey(key: string): Uint8Array {
    try {
      if (key.trim().startsWith('[')) {
        return new Uint8Array(JSON.parse(key));
      }
      return bs58.decode(key);
    } catch (error) {
      throw new Error('Invalid private key format. Must be Base58 or JSON array.');
    }
  }

  async getAuthToken(privateKeyBase58: string, cluster: string = 'devnet', mock: boolean = false): Promise<string> {
    const keypair = Keypair.fromSecretKey(this.decodeKey(privateKeyBase58));
    const address = keypair.publicKey.toBase58();
    
    console.log(`🔑 Authenticating for address: ${address} on ${cluster}...`);

    // 1. Get challenge
    const url = `${this.API_BASE_URL}/challenge?pubkey=${address}&cluster=${cluster}${mock ? '&mock=true' : ''}`;
    console.log(`🌐 Fetching challenge from: ${url}`);
    
    const challengeRes = await fetch(url);
    if (!challengeRes.ok) {
      const errorText = await challengeRes.text();
      console.error(`❌ Challenge request failed: ${errorText}`);
      throw new Error(`Failed to get challenge: ${errorText}`);
    }
    const challengeData = await challengeRes.json();
    console.log(`📥 Challenge received: ${JSON.stringify(challengeData)}`);
    const challenge = challengeData.challenge;

    if (!challenge) {
        throw new Error(`No challenge received from API: ${JSON.stringify(challengeData)}`);
    }

    // 2. Sign challenge
    const message = new TextEncoder().encode(challenge);
    const signature = nacl.sign.detached(message, keypair.secretKey);
    const signatureBase58 = bs58.encode(signature);

    // 3. Login
    const loginRes = await fetch(`${this.API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: address,
        challenge,
        signature: signatureBase58,
        cluster: cluster,
        mock: mock
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${await loginRes.text()}`);
    }
    const loginData = await loginRes.json();
    return loginData.token;
  }

  async executePrivateTransfer(to: string, amount: number, privateKeyBase58: string, cluster: string = 'devnet', mock: boolean = false) {
    try {
      const keypair = Keypair.fromSecretKey(this.decodeKey(privateKeyBase58));
      const token = await this.getAuthToken(privateKeyBase58, cluster, mock);
      
      console.log(`🚀 Executing transfer from ${keypair.publicKey.toBase58()} to ${to} for ${amount} USDC`);

      const body = {
        from: keypair.publicKey.toBase58(),
        to,
        mint: this.getMint(cluster),
        amount: Math.floor(amount * 1_000_000),
        cluster: cluster,
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
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
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
      
      const ephemeralRpc = cluster === 'mainnet' ? "https://mainnet.magicblock.app" : "https://devnet.magicblock.app";
      const baseRpc = cluster === 'mainnet' ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com";
      const conn = new Connection(sendTo === 'ephemeral' ? ephemeralRpc : baseRpc, "confirmed");

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
      console.log(`View on Solscan: https://solscan.io/tx/${sig}?cluster=${cluster}`);
      console.log('==========================================\n');
      return sig;
    } catch (error) {
      console.error(`❌ Private Transfer Failed for ${to}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async getPrivateBalance(address: string, privateKeyBase58: string, cluster: string = 'devnet', mock: boolean = false) {
    try {
      const token = await this.getAuthToken(privateKeyBase58, cluster, mock);
      const mint = this.getMint(cluster);
      
      const response = await fetch(`${this.API_BASE_URL}/private-balance?address=${address}&mint=${mint}&cluster=${cluster}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      const data = await response.json();
      // API returns balance as a string in base units
      const balanceValue = typeof data.balance === 'string' ? parseFloat(data.balance) : data.balance;
      
      return {
        balance: (balanceValue || 0) / 1_000_000,
        ata: data.ata,
        location: data.location
      };
    } catch (error) {
      console.error(`❌ Failed to fetch balance for ${address}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async withdrawPrivateBalance(amount: number, privateKeyBase58: string, cluster: string = 'devnet', mock: boolean = false) {
    try {
      const keypair = Keypair.fromSecretKey(this.decodeKey(privateKeyBase58));
      const token = await this.getAuthToken(privateKeyBase58, cluster, mock);

      console.log(`🚀 Withdrawing ${amount} USDC for ${keypair.publicKey.toBase58()}`);

      const body = {
        owner: keypair.publicKey.toBase58(),
        mint: this.getMint(cluster),
        cluster: cluster,
        amount: Math.floor(amount * 1_000_000),
        initAtasIfMissing: true,
        idempotent: true
      };

      const response = await fetch(`${this.API_BASE_URL}/withdraw`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
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
      
      const ephemeralRpc = cluster === 'mainnet' ? "https://mainnet.magicblock.app" : "https://devnet.magicblock.app";
      const baseRpc = cluster === 'mainnet' ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com";
      const conn = new Connection(sendTo === 'ephemeral' ? ephemeralRpc : baseRpc, "confirmed");

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
      console.log('🎉 Withdrawal Successful!');
      console.log('==========================================');
      console.log(`Amount: ${amount} USDC`);
      console.log(`To: ${keypair.publicKey.toBase58()}`);
      console.log(`Signature: ${sig}`);
      console.log(`View on Solscan: https://solscan.io/tx/${sig}?cluster=${cluster}`);
      console.log('==========================================\n');
      return sig;
    } catch (error) {
      console.error(`❌ Withdrawal Failed:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
