import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { MAIL_SERVICE, MailFactory } from './mail.service';

@Module({
  providers: [
    MailFactory,
    {
      provide: MAIL_SERVICE,
      useFactory: (config: AppConfig, factory: MailFactory) =>
        factory.create(),
      inject: [APP_CONFIG, MailFactory],
    },
  ],
  exports: [MAIL_SERVICE],
})
export class MailModule {}
