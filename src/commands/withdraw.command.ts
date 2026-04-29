import { Command, CommandRunner, Option } from 'nest-commander';
import { MagicBlockService } from '../magicblock.service';
import { Injectable } from '@nestjs/common';
import { password } from '@inquirer/prompts';

interface WithdrawOptions {
  amount: number;
  key?: string;
  mint?: string;
}

@Injectable()
@Command({
  name: 'withdraw',
  description: 'Withdraw funds from your private vault to your public wallet',
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

    let key = options?.key;

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
      console.log(`🚀 Executing withdrawal of ${options.amount} USDC...`);
      // For withdraw, the owner is the public key corresponding to the private key
      // The service already handles getting the keypair
      const sig = await this.magicblock.withdraw(
        '', // owner will be derived from keypair in service if we pass empty
        options.amount,
        key,
        options.mint
      );
      
      console.log('\n==========================================');
      console.log('🎉 Withdrawal Successful!');
      console.log('==========================================');
      console.log(`Amount: ${options.amount} USDC`);
      console.log(`Signature: ${sig}`);
      console.log(`View on Solscan: https://solscan.io/tx/${sig}?cluster=devnet`);
      console.log('==========================================\n');
    } catch (error: any) {
      console.error('❌ Withdrawal Failed:', error.message);
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
    description: 'Private key in Base58 format (optional, prompts if not provided)',
    required: false,
  })
  parseKey(val: string) {
    return val;
  }
  @Option({
    flags: '-m, --mint <address>',
    description: 'SPL Token Mint address (defaults to Devnet USDC)',
    required: false,
  })
  parseMint(val: string) {
    return val;
  }
}
