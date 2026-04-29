import { Module } from '@nestjs/common';
import { MagicBlockService } from './magicblock.service';
import { TransferCommand } from './commands/transfer.command';
import { PayrollCommand } from './commands/payroll.command';

@Module({
  imports: [],
  controllers: [],
  providers: [MagicBlockService, TransferCommand, PayrollCommand],
})
export class AppModule {}
