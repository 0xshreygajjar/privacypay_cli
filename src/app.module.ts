import { Module } from '@nestjs/common';
import { MagicBlockService } from './magicblock.service';
import { TransferCommand } from './commands/transfer.command';
import { PayrollCommand } from './commands/payroll.command';
import { WithdrawCommand } from './commands/withdraw.command';

@Module({
  imports: [],
  controllers: [],
  providers: [MagicBlockService, TransferCommand, PayrollCommand, WithdrawCommand],
})
export class AppModule {}
