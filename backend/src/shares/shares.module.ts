import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { SharesController } from './shares.controller';
import { PublicSharesController } from './public-shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [PrismaModule, AuthModule, UploadsModule],
  controllers: [SharesController, PublicSharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}

