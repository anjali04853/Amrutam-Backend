import { randomUUID } from 'crypto';
import { AppError } from '../../common/errors';

export class PaymentGatewayError extends AppError {
  constructor(message: string) {
    super(message, 402, 'PAYMENT_DECLINED');
  }
}

export interface ChargeOptions {
  forceOutcome?: 'success' | 'fail' | 'timeout';
}

export class MockPaymentGateway {
  async charge(_amount: number, opts: ChargeOptions = {}): Promise<{ providerRef: string }> {
    const outcome = opts.forceOutcome ?? 'success';
    if (outcome === 'fail') {
      throw new PaymentGatewayError('Payment declined by provider');
    }
    if (outcome === 'timeout') {
      throw new PaymentGatewayError('Payment provider timed out');
    }
    return { providerRef: `mock-${randomUUID()}` };
  }
}
