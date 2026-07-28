import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { OutboundMessage, PushChannel, SmsChannel } from './channel.types';

/** SMS stub — ready for Twilio / etc. */
@Injectable()
export class SmsChannelStub implements SmsChannel {
  readonly channel = 'SMS' as const;

  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(SmsChannelStub.name);
  }

  isConfigured(): boolean {
    return false;
  }

  async send(message: OutboundMessage): Promise<void> {
    this.logger.warn(`SMS channel not implemented — skipped to=${message.to}`);
    throw new Error('SMS channel is not implemented');
  }
}

/** Push stub — ready for FCM / APNs. */
@Injectable()
export class PushChannelStub implements PushChannel {
  readonly channel = 'PUSH' as const;

  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(PushChannelStub.name);
  }

  isConfigured(): boolean {
    return false;
  }

  async send(message: OutboundMessage): Promise<void> {
    this.logger.warn(`Push channel not implemented — skipped to=${message.to}`);
    throw new Error('Push channel is not implemented');
  }
}
