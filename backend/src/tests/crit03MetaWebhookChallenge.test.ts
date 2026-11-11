// Force an isolated ephemeral test database before loading env/db config
process.env.MONGODB_URI =
  process.env.CRIT03_CHALLENGE_TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_qa_crit03_get';

import http from 'http';
import crypto from 'crypto';
import { Writable } from 'stream';
import mongoose from 'mongoose';
import winston from 'winston';
import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { logger } from '../config/logger';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

const assert = (condition: boolean, testName: string, failureReason?: string) => {
  if (condition) {
    results.push({ name: testName, passed: true });
    console.log(`  [PASS] ${testName}`);
  } else {
    results.push({ name: testName, passed: false, error: failureReason || 'Assertion failed' });
    console.error(`  [FAIL] ${testName}: ${failureReason || 'Assertion failed'}`);
  }
};

const runChallengeTests = async () => {
  console.log('\n==================================================');
  console.log('Running CRIT-03 Issue 2: Meta GET Webhook Verification Tests');
  console.log('==================================================\n');

  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }

  if (mongoose.connection.name !== 'flumenx_qa_crit03_get') {
    throw new Error(`Refusing to run on non-isolated database: ${mongoose.connection.name}`);
  }

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const nativeFetch = globalThis.fetch.bind(globalThis);
  const prevVerifyToken = process.env.META_VERIFY_TOKEN;
  const prevAppSecret = process.env.META_APP_SECRET;

  const testVerifyToken = 'TEST_META_VERIFY_TOKEN_XYZ_987654';
  const testAppSecret = 'TEST_META_APP_SECRET_DO_NOT_REUSE_123';
  const wrongLongToken = 'WRONG_LONGER_SUPPLIED_VERIFY_TOKEN_FOR_LENGTH_CHECK_' + 'X'.repeat(80);
  const wrongShortToken = 'bad';

  const capturedLogs: string[] = [];
  const logSpyTransport = new winston.transports.Stream({
    stream: new Writable({
      write(chunk, _enc, cb) {
        capturedLogs.push(chunk.toString());
        cb();
      },
    }),
  });
  logger.add(logSpyTransport);

  // Prevent accidental external HTTP requests
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith(`http://127.0.0.1:${port}`) && !url.startsWith(`http://localhost:${port}`)) {
      throw new Error(`Unexpected external fetch intercepted in GET challenge test: ${url}`);
    }
    return nativeFetch(input as any, init);
  }) as typeof fetch;

  try {
    process.env.META_VERIFY_TOKEN = testVerifyToken;
    process.env.META_APP_SECRET = testAppSecret;

    // 1 & 2. Correct token + subscribe mode returns HTTP 200 with exact raw plain-text challenge
    const numericChallenge = '115820124';
    const specialChallenge = 'ch_meta+test/987_exact=';

    const validNumericRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(testVerifyToken)}&hub.challenge=${encodeURIComponent(numericChallenge)}`
    );
    const validNumericText = await validNumericRes.text();
    const validSpecialRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(testVerifyToken)}&hub.challenge=${encodeURIComponent(specialChallenge)}`
    );
    const validSpecialText = await validSpecialRes.text();

    assert(
      validNumericRes.status === 200 &&
        (validNumericRes.headers.get('content-type') || '').includes('text/plain') &&
        validNumericText === numericChallenge,
      '1 & 2a. Valid subscribe handshake returns HTTP 200 text/plain with exact numeric challenge'
    );
    assert(
      validSpecialRes.status === 200 &&
        (validSpecialRes.headers.get('content-type') || '').includes('text/plain') &&
        validSpecialText === specialChallenge,
      '2b. Exact non-numeric/special challenge echoed verbatim without JSON encoding'
    );

    // 3. Incorrect token rejected (403) + ensure META_APP_SECRET is NOT accepted as verify_token
    const wrongTokRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent('wrong_verify_token')}&hub.challenge=12345`
    );
    const appSecretAsVerifyTokRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(testAppSecret)}&hub.challenge=12345`
    );
    assert(
      wrongTokRes.status === 403 && appSecretAsVerifyTokRes.status === 403,
      '3. Incorrect verify_token (including META_APP_SECRET reuse attempt) is rejected with 403'
    );

    // 4. Missing token rejected (403)
    const missingTokRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.challenge=12345`
    );
    const emptyTokRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=&hub.challenge=12345`
    );
    assert(
      missingTokRes.status === 403 && emptyTokRes.status === 403,
      '4. Missing or empty hub.verify_token is rejected with 403'
    );

    // 5. Missing challenge rejected (400)
    const missingChallengeRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(testVerifyToken)}`
    );
    const emptyChallengeRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(testVerifyToken)}&hub.challenge=`
    );
    assert(
      missingChallengeRes.status === 400 && emptyChallengeRes.status === 400,
      '5. Missing or empty hub.challenge is rejected with 400'
    );

    // 6. Invalid mode rejected (400)
    const invalidModeRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=unsubscribe&hub.verify_token=${encodeURIComponent(testVerifyToken)}&hub.challenge=12345`
    );
    const missingModeRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.verify_token=${encodeURIComponent(testVerifyToken)}&hub.challenge=12345`
    );
    assert(
      invalidModeRes.status === 400 && missingModeRes.status === 400,
      '6. Invalid or missing hub.mode is rejected with 400'
    );

    // 7. Missing META_VERIFY_TOKEN fails closed (503)
    delete process.env.META_VERIFY_TOKEN;
    const missingConfigRes1 = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=anything&hub.challenge=12345`
    );
    const missingConfigRes2 = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(testAppSecret)}&hub.challenge=12345`
    );
    const missingConfigText = await missingConfigRes1.text();
    assert(
      missingConfigRes1.status === 503 &&
        missingConfigRes2.status === 503 &&
        !missingConfigText.includes('12345'),
      '7. Missing META_VERIFY_TOKEN fails closed with 503 without echoing challenge'
    );
    process.env.META_VERIFY_TOKEN = testVerifyToken;

    // 8. Token comparison handles short, longer, and array query token parameters safely (never throws 500)
    const shortRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(wrongShortToken)}&hub.challenge=12345`
    );
    const longRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(wrongLongToken)}&hub.challenge=12345`
    );
    const arrayParamRes = await fetch(
      `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(testVerifyToken)}&hub.verify_token=second&hub.challenge=12345`
    );
    const shortText = await shortRes.text();
    const longText = await longRes.text();
    assert(
      shortRes.status === 403 && longRes.status === 403 && arrayParamRes.status === 403,
      '8. Differing token lengths and duplicate query params handled safely with 403'
    );

    // 9. Actual token values never appear in logs or HTTP error responses
    const combinedLogs = capturedLogs.join('\n');
    const badJsonText = await wrongTokRes.text();
    assert(
      !combinedLogs.includes(testVerifyToken) &&
        !combinedLogs.includes(wrongShortToken) &&
        !combinedLogs.includes(wrongLongToken) &&
        !badJsonText.includes(testVerifyToken) &&
        !shortText.includes(testVerifyToken) &&
        !longText.includes(testVerifyToken),
      '9. Actual configured and supplied verify tokens never appear in logs or responses'
    );

    // 10. All existing GET route prefixes behave consistently
    const prefixes = [
      '/conversations/webhook',
      '/conversations/webhook/whatsapp',
      '/conversations/webhooks',
      '/conversations/webhooks/whatsapp',
      '/client/webhooks/conversations',
      '/client/webhooks/conversations/whatsapp',
    ];
    let allRoutesConsistent = true;
    for (const prefix of prefixes) {
      const okRes = await fetch(
        `${baseUrl}${prefix}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(testVerifyToken)}&hub.challenge=route_ok_777`
      );
      const okText = await okRes.text();
      const failRes = await fetch(
        `${baseUrl}${prefix}?hub.mode=subscribe&hub.verify_token=bad_token&hub.challenge=route_ok_777`
      );
      if (okRes.status !== 200 || okText !== 'route_ok_777' || failRes.status !== 403) {
        allRoutesConsistent = false;
      }
    }
    assert(
      allRoutesConsistent,
      '10. All 6 mounted Meta GET webhook routes enforce verify_token and return exact challenge consistently'
    );

    // 11. Existing POST X-Hub-Signature-256 verification remains unaffected
    const metaPostBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const postSig = `sha256=${crypto.createHmac('sha256', testAppSecret).update(Buffer.from(metaPostBody, 'utf8')).digest('hex')}`;
    const unsignedPost = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: metaPostBody,
    });
    const signedPost = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': postSig,
      },
      body: metaPostBody,
    });
    assert(
      unsignedPost.status === 401 && signedPost.status === 200,
      '11. Existing POST X-Hub-Signature-256 signature verification remains unaffected'
    );
  } finally {
    logger.remove(logSpyTransport);
    if (prevVerifyToken !== undefined) process.env.META_VERIFY_TOKEN = prevVerifyToken;
    else delete process.env.META_VERIFY_TOKEN;
    if (prevAppSecret !== undefined) process.env.META_APP_SECRET = prevAppSecret;
    else delete process.env.META_APP_SECRET;
    globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === 'flumenx_qa_crit03_get') {
      await mongoose.connection.dropDatabase();
    }
    await disconnectDatabase();
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log('\n--------------------------------------------------');
  console.log(`CRIT-03 Issue 2 Results: ${passedCount} passed, ${failedCount} failed (Total: ${results.length})`);
  console.log('--------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  }
};

runChallengeTests().catch((err) => {
  console.error('CRIT-03 Issue 2 Test Suite fatal error:', err);
  process.exit(1);
});

