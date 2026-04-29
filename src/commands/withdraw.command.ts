import { Command, CommandRunner, Option } from 'nest-commander';
import { MagicBlockService } from '../magicblock.service';
import { Injectable } from '@nestjs/common';
import { password } from '@inquirer/prompts';

interface WithdrawOptions {
  amount: number;
  key?: string;
  cluster?: string;
  mock?: boolean;
}

@Injectable()
@Command({
  name: 'withdraw',
  description: 'Withdraw funds from the private vault to the base wallet',
})
export class WithdrawCommand extends CommandRunner {
  constructor(private readonly magicblock: MagicBlockService) {
    super();
  }

  async run(passedParam: string[], options?: WithdrawOptions): Promise<void> {
    if (!options?.amount) {
      console.error('❌ Error: Missing required option: --amount is required.');
      return;
    }

    let key = options?.key || process.env.PRIVATE_KEY || process.env.PRIVATEKEY;

    if (!key) {
      key = await password({
        message: 'Please enter your private key (required for authentication):',
        mask: '*',
      });
    }

    if (!key) {
      console.error('❌ Error: Private key is required.');
      return;
    }

    const cluster = options?.cluster || 'devnet';
    const mock = !!options?.mock;

    try {
      await this.magicblock.withdrawPrivateBalance(options.amount, key, cluster, mock);
    } catch (error) {
      // Error already logged in service
    }
  }

  @Option({
    flags: '-a, --amount <number>',
    description: 'Amount of tokens to withdraw',
    required: true,
  })
  parseAmount(val: string) {
    return parseFloat(val);
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
