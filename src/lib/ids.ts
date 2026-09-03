export const SEED = {
  clientId: '11111111-1111-4111-8111-111111111111',
  transporterId: '22222222-2222-4222-8222-222222222222',
  vehicleId: '33333333-3333-4333-8333-333333333333',
  routeId: '44444444-4444-4444-8444-444444444444',
  groupId: '55555555-5555-4555-8555-555555555555',
  pointA: '66666666-6666-4666-8666-666666666661',
  pointB: '66666666-6666-4666-8666-666666666662',
  pointC: '66666666-6666-4666-8666-666666666663',
} as const;

export const MOCK_OTP = '123456';
export const MOCK_PASSWORD = 'senha123';

export const DEMO_ACCOUNTS = {
  client: {
    email: 'cliente@embarqueai.com',
    password: MOCK_PASSWORD,
  },
  transporter: {
    email: 'transportador@embarqueai.com',
    password: MOCK_PASSWORD,
  },
} as const;

export const EMAIL_ALIASES: Record<string, string> = {
  'cliente@vango.com': DEMO_ACCOUNTS.client.email,
  'transportador@vango.com': DEMO_ACCOUNTS.transporter.email,
};

