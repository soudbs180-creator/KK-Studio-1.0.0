export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(error: unknown, fallbackMessage = 'Internal server error'): Response {
  if (error instanceof HttpError) {
    return jsonResponse({
      success: false,
      error: error.message,
    }, error.status);
  }

  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message || '').trim() || fallbackMessage
      : fallbackMessage;

  return jsonResponse({
    success: false,
    error: message,
  }, 500);
}
