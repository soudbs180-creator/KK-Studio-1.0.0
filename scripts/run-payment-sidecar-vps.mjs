import { createPaymentSidecarServer } from "../apps/payment-sidecar/src/server.ts";

const port = Number(process.env.PAYMENT_SIDECAR_PORT || process.env.PORT || 3002);

createPaymentSidecarServer(port);
