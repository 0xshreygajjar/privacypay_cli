import { Module } from '@nestjs/common';
import { MagicBlockService } from './magicblock.service';
import { TransferCommand } from './commands/transfer.command';

@Module({
  imports: [],
  controllers: [],
  providers: [MagicBlockService, TransferCommand],
})
export class AppModule {}
