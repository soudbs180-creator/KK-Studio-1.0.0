import assert from 'node:assert/strict';
import test from 'node:test';

interface VerificationError extends Error {
  code?: string;
}

async function loadVerifier() {
  const module = await import('../../services/api/lib/capability-graph/connectionVerifier.js');
  return module.default || module;
}

test('connection verifier rejects private DNS answers before provider fetch', async () => {
  const { verifyConnectionEndpoint } = await loadVerifier();
  let fetchCalled = false;

  await assert.rejects(
    () => verifyConnectionEndpoint({
      providerId: 'custom',
      protocolProfile: 'openai-compatible',
      endpoint: 'https://provider.example.test/v1',
      secret: 'private-key',
    }, {
      lookup: async () => [{ address: '127.0.0.1', family: 4 }],
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response('{}', { status: 200 });
      },
    }),
    (error: VerificationError) => error.code === 'ENDPOINT_PRIVATE_ADDRESS',
  );

  assert.equal(fetchCalled, false);
});

test('google verification uses a header secret and blocks redirects', async () => {
  const { verifyConnectionEndpoint } = await loadVerifier();
  const secret = 'google-request-only-secret';
  let requestedUrl = '';
  let requestedSecret = '';

  await assert.rejects(
    () => verifyConnectionEndpoint({
      providerId: 'google',
      protocolProfile: 'google-official',
      endpoint: 'https://generativelanguage.googleapis.com',
      secret,
    }, {
      lookup: async () => [{ address: '142.250.72.234', family: 4 }],
      fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
        requestedUrl = String(input);
        requestedSecret = new Headers(init?.headers).get('x-goog-api-key') ?? '';
        return new Response(null, { status: 302, headers: { location: 'https://redirect.example.test' } });
      },
    }),
    (error: VerificationError) => error.code === 'PROVIDER_REDIRECT_REJECTED',
  );

  assert.equal(requestedUrl.includes(secret), false);
  assert.equal(requestedSecret, secret);
});

test('google verification returns the image capability without echoing credentials', async () => {
  const { verifyConnectionEndpoint } = await loadVerifier();
  const result = await verifyConnectionEndpoint({
    providerId: 'google',
    protocolProfile: 'google-official',
    endpoint: 'https://generativelanguage.googleapis.com',
    secret: 'valid-google-secret',
  }, {
    lookup: async () => [{ address: '142.250.72.234', family: 4 }],
    fetchImpl: async () => new Response('{}', { status: 200 }),
  });

  assert.equal(result.status, 'available');
  assert.deepEqual(result.bindings, [{
    modelId: 'gemini-2.5-flash-image',
    capabilityId: 'image.generate',
    channel: 'byok',
    requestProfile: 'google-generate-content-v1beta',
  }]);
  assert.equal(JSON.stringify(result).includes('valid-google-secret'), false);
});
