import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../app-config';

export type MailKind = 'verify-email' | 'reset-password';

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  kind: MailKind;
  code: string;
};

export type MailSender = {
  send(input: MailInput): Promise<void>;
};

export const MAIL_SERVICE = 'MAIL_SERVICE';

const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 8000;

// Penyedia Resend lewat fetch bawaan (tanpa dependency, tanpa retry).
// Error dilempar TANPA body request, TANPA kunci API, TANPA alamat
// penerima: hanya status HTTP dan tahap kegagalan.
export class ResendMailService implements MailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly contactEmail: string | undefined,
  ) {}

  async send(input: MailInput): Promise<void> {
    const payload: Record<string, unknown> = {
      from: this.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    };
    if (this.contactEmail) {
      payload.reply_to = this.contactEmail;
    }
    let response: Response;
    try {
      response = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });
    } catch {
      throw new Error('Resend request failed');
    }
    if (!response.ok) {
      throw new Error(`Resend error: HTTP ${response.status}`);
    }
  }
}

// Penyedia log: HANYA non-produksi. Satu-satunya tempat kode OTP boleh
// muncul di log, dengan guard eksplisit agar tak pernah di produksi.
export class LogMailService implements MailSender {
  async send(input: MailInput): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MAIL_PROVIDER=log tidak diizinkan di production.');
    }
    // Format baris: [mail:dev] <jenis> untuk <email> kode <kode>
    console.log(
      `[mail:dev] ${input.kind} untuk ${input.to} kode ${input.code}`,
    );
  }
}

@Injectable()
export class MailFactory {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  create(): MailSender {
    if (this.config.mailProvider === 'resend') {
      return new ResendMailService(
        this.config.mailApiKey as string,
        this.config.mailFrom as string,
        this.config.contactEmail,
      );
    }
    return new LogMailService();
  }
}
