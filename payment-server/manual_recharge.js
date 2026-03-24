require('dotenv').config();

function main() {
  const message = [
    '[manual_recharge] This legacy script has been retired.',
    '[manual_recharge] Do not write credits directly from payment-server.',
    '[manual_recharge] Use the migrated billing/payment flow instead:',
    '  1. create a payment order through apps/payment-sidecar or the typed web client',
    '  2. let the payment callback settle through POST /internal/v1/payment-settlements',
    '  3. use the admin billing API for intentional manual credit adjustments',
  ].join('\n');

  throw new Error(message);
}

main();
