import { Module } from '@nestjs/common';
import { MagicBlockService } from './magicblock.service';
import { TransferCommand } from './commands/transfer.command';
import { BalanceCommand } from './commands/balance.command';
import { WithdrawCommand } from './commands/withdraw.command';

@Module({
  imports: [],
  controllers: [],
  providers: [MagicBlockService, TransferCommand, BalanceCommand, WithdrawCommand],
})
export class AppModule {}
