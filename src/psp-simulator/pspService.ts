import { v4 as uuidv4 } from 'uuid';
import { PspTransactionRequest } from '../types/transaction';

/**
 * Card number prefix rules that determine the PSP outcome.
 */
const CARD_PREFIX_RULES: { prefix: string; status: string }[] = [
    { prefix: '4111', status: '3DS_REQUIRED' },
    { prefix: '5555', status: 'SUCCESS' },
    { prefix: '4000', status: 'FAILED' },
];

/**
 * Default status when no card prefix rule matches.
 */
const DEFAULT_PSP_STATUS = 'FAILED';

/**
 * 3DS transaction expiry timeout in milliseconds (5 minutes).
 * If a client doesn't complete 3DS verification within this window,
 * the PSP simulator sends a FAILED webhook automatically.
 */
const THREE_DS_EXPIRY_MS = 5 * 60 * 1000;

/**
 * In-memory store for pending 3DS transactions within the PSP simulator.
 */
interface Pending3dsTransaction {
    pspTransactionId: string;
    callbackUrl: string;
    amount: number;
}

/** Store for pending 3DS transactions, keyed by PSP transaction ID */
const pending3dsTransactions: Map<string, Pending3dsTransaction> = new Map();

/** Store for 3DS expiry timers, keyed by PSP transaction ID */
const expiryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

/**
 * Determines the PSP outcome based on card number prefix.
 */
export function determineOutcome(cardNumber: string): string {
    for (const rule of CARD_PREFIX_RULES) {
        if (cardNumber.startsWith(rule.prefix)) {
            return rule.status;
        }
    }
    return DEFAULT_PSP_STATUS;
}

/**
 * Sends a webhook callback to the specified URL.
 */
export async function sendWebhookCallback(
    callbackUrl: string,
    payload: { transactionId: string; final_amount: number; status: string },
): Promise<void> {
    try {
        await fetch(callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to send webhook to ${callbackUrl}: ${errorMessage}`);
    }
}

/**
 * Starts a 5-minute expiry timer for a pending 3DS transaction.
 * If the client doesn't complete verification in time,
 * a FAILED webhook is sent and the transaction is cleaned up.
 */
function startExpiryTimer(pspTransactionId: string, callbackUrl: string, amount: number): void {
    const timer = setTimeout(() => {
        // Check if the transaction is still pending (not already resolved)
        if (pending3dsTransactions.has(pspTransactionId)) {
            pending3dsTransactions.delete(pspTransactionId);
            expiryTimers.delete(pspTransactionId);

            console.warn(`3DS transaction ${pspTransactionId} expired after ${THREE_DS_EXPIRY_MS / 1000}s — sending FAILED webhook`);

            sendWebhookCallback(callbackUrl, {
                transactionId: pspTransactionId,
                final_amount: amount,
                status: 'FAILED',
            });
        }
    }, THREE_DS_EXPIRY_MS);

    // Don't block process exit
    if (timer && typeof timer === 'object' && 'unref' in timer) {
        timer.unref();
    }

    expiryTimers.set(pspTransactionId, timer);
}

/**
 * Cancels the expiry timer for a 3DS transaction (called when client resolves it).
 */
function cancelExpiryTimer(pspTransactionId: string): void {
    const timer = expiryTimers.get(pspTransactionId);
    if (timer) {
        clearTimeout(timer);
        expiryTimers.delete(pspTransactionId);
    }
}

/**
 * Processes a PSP transaction request and returns the appropriate response.
 * For SUCCESS/FAILED: sends webhook immediately.
 * For 3DS_REQUIRED: stores pending transaction, starts expiry timer, and returns redirect URL.
 */
export function processTransaction(
    request: PspTransactionRequest,
    pspBaseUrl: string,
): { transactionId: string; status: string; threeDsRedirectUrl?: string } {
    const pspTransactionId = `tx_${uuidv4().slice(0, 8)}`;
    const outcome = determineOutcome(request.cardNumber);

    if (outcome === 'SUCCESS' || outcome === 'FAILED') {
        // Send webhook asynchronously (fire and forget)
        setImmediate(() => {
            sendWebhookCallback(request.callbackUrl, {
                transactionId: pspTransactionId,
                final_amount: request.amount,
                status: outcome,
            });
        });

        return {
            transactionId: pspTransactionId,
            status: outcome,
        };
    }

    // 3DS_REQUIRED: store pending transaction for later resolution
    pending3dsTransactions.set(pspTransactionId, {
        pspTransactionId,
        callbackUrl: request.callbackUrl,
        amount: request.amount,
    });

    // Start expiry timer — auto-fail if client doesn't complete 3DS in time
    startExpiryTimer(pspTransactionId, request.callbackUrl, request.amount);

    return {
        transactionId: pspTransactionId,
        status: '3DS_REQUIRED',
        threeDsRedirectUrl: `${pspBaseUrl}/3ds/${pspTransactionId}`,
    };
}

/**
 * Resolves a pending 3DS transaction. Cancels the expiry timer,
 * sends a SUCCESS webhook after a delay to simulate processing time.
 * Returns an HTML page confirming 3DS completion.
 */
export function resolve3dsTransaction(pspTransactionId: string): {
    found: boolean;
    html?: string;
} {
    const pendingTransaction = pending3dsTransactions.get(pspTransactionId);
    if (!pendingTransaction) {
        return { found: false };
    }

    // Remove from pending store and cancel the expiry timer
    pending3dsTransactions.delete(pspTransactionId);
    cancelExpiryTimer(pspTransactionId);

    // Send webhook after a short delay to simulate 3DS processing
    const delayTimer = setTimeout(() => {
        sendWebhookCallback(pendingTransaction.callbackUrl, {
            transactionId: pspTransactionId,
            final_amount: pendingTransaction.amount,
            status: 'SUCCESS',
        });
    }, 1500);

    // Prevent the timer from keeping the process alive (important for tests)
    if (delayTimer && typeof delayTimer === 'object' && 'unref' in delayTimer) {
        delayTimer.unref();
    }

    const confirmationHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>3DS Verification</title></head>
      <body>
        <h1>3DS Verification Complete</h1>
        <p>Transaction <strong>${pspTransactionId}</strong> has been verified.</p>
        <p>You will be redirected shortly...</p>
      </body>
    </html>
  `;

    return { found: true, html: confirmationHtml };
}
