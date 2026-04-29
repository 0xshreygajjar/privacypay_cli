import { Command, CommandRunner, Option } from 'nest-commander';
import { MagicBlockService } from '../magicblock.service';
import { Injectable } from '@nestjs/common';

interface TransferOptions {
  to: string;
  amount: number;
  key: string;
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
    if (!options?.to || !options?.amount || !options?.key) {
      console.error('❌ Error: Missing required options: --to, --amount, and --key are required.');
      return;
    }

    try {
      await this.magicblock.executePrivateTransfer(options.to, options.amount, options.key);
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
    description: 'Sender private key in Base58 format',
    required: true,
  })
  parseKey(val: string) {
    return val;
  }
}
