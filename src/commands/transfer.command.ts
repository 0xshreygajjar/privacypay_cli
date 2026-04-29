import { Command, CommandRunner, Option } from 'nest-commander';
import { MagicBlockService } from '../magicblock.service';
import { Injectable } from '@nestjs/common';
import { password } from '@inquirer/prompts';

interface TransferOptions {
  to: string;
  amount: number;
  key?: string;
}

@Injectable()
@Command({
  name: 'transfer',
  description: 'Execute a single private transfer using MagicBlock API',
})
export class TransferCommand extends CommandRunner {
  constructor(private readonly magicblock: MagicBlockService) {
    super();
  }

  async run(passedParam: string[], options?: TransferOptions): Promise<void> {
    if (!options?.to || !options?.amount) {
      console.error('❌ Error: Missing required options: --to and --amount are required.');
      return;
    }

    let key = options?.key || process.env.PRIVATE_KEY || process.env.PRIVATEKEY;

    if (!key) {
      key = await password({
        message: 'Please enter your private key:',
        mask: '*',
      });
    }

    if (!key) {
      console.error('❌ Error: Private key is required.');
      return;
    }

    try {
      await this.magicblock.executePrivateTransfer(options.to, options.amount, key);
    } catch (error) {
      // Error already logged in service
    }
  }

  @Option({
    flags: '-t, --to <address>',
    description: 'Destination Solana Wallet address',
    required: true,
  })
  parseTo(val: string) {
    return val;
  }

  @Option({
    flags: '-a, --amount <number>',
    description: 'Amount of tokens to transfer',
    required: true,
  })
  parseAmount(val: string) {
    return parseFloat(val);
  }

  @Option({
    flags: '-k, --key <privateKeyBase58>',
    description: 'Sender private key in Base58 format (optional, prompts if not provided)',
    required: false,
  })
  parseKey(val: string) {
    return val;
  }
}
