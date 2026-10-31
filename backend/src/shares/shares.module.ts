import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SharesController } from './shares.controller';
import { PublicSharesController } from './public-shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [PrismaModule],
  controllers: [SharesController, PublicSharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}

