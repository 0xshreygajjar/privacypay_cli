import { Command, CommandRunner, Option } from 'nest-commander';
import { MagicBlockService } from '../magicblock.service';
import { Injectable } from '@nestjs/common';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { password } from '@inquirer/prompts';

interface BalanceOptions {
  address?: string;
  key?: string;
  cluster?: string;
  mock?: boolean;
}

@Injectable()
@Command({
  name: 'balance',
  description: 'Check the private balance of a user',
})
export class BalanceCommand extends CommandRunner {
  constructor(private readonly magicblock: MagicBlockService) {
    super();
  }

  private decodeKey(key: string): Uint8Array {
    try {
      if (key.trim().startsWith('[')) {
        return new Uint8Array(JSON.parse(key));
      }
      return bs58.decode(key);
    } catch (error) {
      throw new Error('Invalid private key format.');
    }
  }

  async run(passedParam: string[], options?: BalanceOptions): Promise<void> {
    let key = options?.key || process.env.PRIVATE_KEY || process.env.PRIVATEKEY;

    if (!key) {
      key = await password({
        message: 'Please enter your private key (required for authentication):',
        mask: '*',
      });
    }

    if (!key) {
      console.error('❌ Error: Private key is required for authentication.');
      return;
    }

    let address = options?.address;
    if (!address) {
      try {
        const keypair = Keypair.fromSecretKey(this.decodeKey(key));
        address = keypair.publicKey.toBase58();
      } catch (error) {
        console.error('❌ Error: Could not derive address from private key.');
        return;
      }
    }

    const cluster = options?.cluster || 'devnet';
    const mock = !!options?.mock;

    try {
      const data = await this.magicblock.getPrivateBalance(address, key, cluster, mock);
      console.log('\n==========================================');
      console.log('💰 Private Balance');
      console.log('==========================================');
      console.log(`Address:  ${address}`);
      console.log(`Balance:  ${data.balance} USDC`);
      console.log(`ATA:      ${data.ata}`);
      console.log(`Location: ${data.location}`);
      console.log(`Cluster:  ${cluster}`);
      console.log('==========================================\n');
    } catch (error) {
      // Error already logged in service
    }
  }

  @Option({
    flags: '-t, --address <address>',
    description: 'Solana Wallet address to check balance for',
    required: false,
  })
  parseAddress(val: string) {
    return val;
  }

  @Option({
    flags: '-k, --key <privateKeyBase58>',
    description: 'Sender private key to authenticate (optional if in .env)',
    required: false,
  })
  parseKey(val: string) {
    return val;
  }

  @Option({
    flags: '-c, --cluster <string>',
    description: 'Solana cluster (devnet or mainnet)',
    defaultValue: 'devnet',
  })
  parseCluster(val: string) {
    return val;
  }

  @Option({
    flags: '-m, --mock',
    description: 'Use mock authentication flow for testing',
    defaultValue: false,
  })
  parseMock(val: string) {
    return true;
  }
}
