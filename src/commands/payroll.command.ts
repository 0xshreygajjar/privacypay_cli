import { Command, CommandRunner, Option } from 'nest-commander';
import { MagicBlockService } from '../magicblock.service';
import { Injectable } from '@nestjs/common';
import { password } from '@inquirer/prompts';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

interface PayrollOptions {
  file: string;
  key?: string;
  memo?: string;
}

@Injectable()
@Command({
  name: 'payroll',
  description: 'Execute batch private transfers from a CSV file',
})
export class PayrollCommand extends CommandRunner {
  constructor(private readonly magicblock: MagicBlockService) {
    super();
  }

  async run(passedParam: string[], options?: PayrollOptions): Promise<void> {
    if (!options?.file) {
      console.error('❌ Error: Missing required option: --file is required.');
      return;
    }

    if (!fs.existsSync(options.file)) {
      console.error(`❌ Error: File not found: ${options.file}`);
      return;
    }

    let key = options?.key;

    if (!key) {
      key = await password({
        message: 'Please enter your private key (base58):',
        mask: '*',
      });
    }

    if (!key) {
      console.error('❌ Error: Private key is required.');
      return;
    }

    const fileContent = fs.readFileSync(options.file, 'utf-8');
    let records: any[];
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (error) {
      console.error('❌ Error: Failed to parse CSV file. Ensure it has "recipient" and "amount" columns.');
      return;
    }

    if (records.length === 0) {
      console.warn('⚠️ Warning: CSV file is empty.');
      return;
    }

    console.log(`\n📦 Found ${records.length} transfers to execute.\n`);

    const transfers = records
      .filter((r) => r.recipient && r.amount)
      .map((r) => ({
        to: r.recipient,
        amount: parseFloat(r.amount),
      }));

    if (transfers.length === 0) {
      console.warn('⚠️ Warning: No valid transfers found in CSV.');
      return;
    }

    const batchResults = await this.magicblock.executeBatchTransfer(
      transfers,
      key,
      options?.memo || 'Payroll',
      (current, total, msg) => {
        process.stdout.write(`\r⏳ ${msg.padEnd(50)} [${current}/${total}]`);
      },
    );
    process.stdout.write('\n');

    const results = batchResults.map((r) => ({
      recipient: r.to,
      amount: r.amount,
      status: r.status === 'success' ? 'Success' : 'Failed',
      signature: r.status === 'success' ? r.signature : undefined,
      error: r.status === 'failed' ? r.error : undefined,
    }));

    this.printSummary(results);
  }

  private printSummary(results: any[]) {
    const success = results.filter((r) => r.status === 'Success');
    const failed = results.filter((r) => r.status === 'Failed');

    console.log('\n================ Payroll Summary ================');
    console.log(`Total Transfers: ${results.length}`);
    console.log(`✅ Successful:   ${success.length}`);
    console.log(`❌ Failed:       ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('\nFailed Transfers:');
      failed.forEach(f => console.log(`- ${f.recipient} (${f.amount} USDC): ${f.error}`));
    }
    
    console.log('==================================================\n');
  }

  @Option({
    flags: '-f, --file <path>',
    description: 'Path to the CSV file (columns: recipient, amount)',
    required: true,
  })
  parseFile(val: string) {
    return val;
  }

  @Option({
    flags: '-k, --key <privateKeyBase58>',
    description: 'Sender private key in Base58 format (optional, prompts if not provided)',
    required: false,
  })
  parseKey(val: string) {
    return val;
  }

  @Option({
    flags: '-m, --memo <string>',
    description: 'Transaction memo (optional, default: Payroll)',
    required: false,
  })
  parseMemo(val: string) {
    return val;
  }
}
