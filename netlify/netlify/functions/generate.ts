import { GoogleGenAI } from "@google/genai";

interface GenerateRequest {
    prompt: string;
    aspectRatio: string;
    imageSize?: string;
    model: string;
    referenceImages?: Array<{ data: string; mimeType: string }>;
    apiKey?: string;
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...corsHeaders,
        },
    });

export default async (request: Request) => {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        const body: GenerateRequest = await request.json();
        const { prompt, aspectRatio, imageSize, model, referenceImages, apiKey } = body;
        const effectiveApiKey = String(apiKey || "").trim();

        // Never fall back to a server-side shared API key here.
        // This endpoint is public and would otherwise become a spend-abuse proxy.
        if (!effectiveApiKey) {
            return jsonResponse(
                {
                    error: "A user-scoped API key is required. Shared server fallback keys are disabled for security.",
                },
                400,
            );
        }

        if (!prompt) {
            return jsonResponse({ error: "Prompt is required" }, 400);
        }

        if (!model) {
            return jsonResponse({ error: "Model is required" }, 400);
        }

        if (!aspectRatio) {
            return jsonResponse({ error: "Aspect ratio is required" }, 400);
        }

        // Initialize Gemini client
        const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

        // Build content parts
        const parts: any[] = [];

        // Add reference images if provided
        if (referenceImages && referenceImages.length > 0) {
            for (const img of referenceImages) {
                parts.push({
                    inlineData: {
                        data: img.data,
                        mimeType: img.mimeType,
                    },
                });
            }
        }

        // Add prompt text
        parts.push({ text: prompt });

        // Build image generation config
        const imageConfig: any = { aspectRatio };
        if (model === "imagen-3.0-generate-002" && imageSize) {
            imageConfig.imageSize = imageSize;
        }

        // Call Gemini API
        const response = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts }],
            config: { imageConfig },
        });

        // Extract image from response
        if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData?.data) {
                        return jsonResponse(
                            {
                                success: true,
                                imageData: part.inlineData.data,
                                mimeType: part.inlineData.mimeType || "image/png",
                            },
                            200,
                        );
                    }
                }
            }
        }

        return jsonResponse({ error: "No image generated" }, 500);

    } catch (error: any) {
        console.error("Generation error:", error);

        let errorMessage = error.message || "Generation failed";
        let statusCode = 500;

        // Parse common Gemini API errors
        if (errorMessage.includes("403") || errorMessage.includes("permission")) {
            errorMessage = "API Key invalid or billing not enabled";
            statusCode = 403;
        } else if (errorMessage.includes("400") || errorMessage.includes("INVALID_ARGUMENT")) {
            errorMessage = "Invalid request - model may not support this configuration";
            statusCode = 400;
        } else if (errorMessage.includes("leaked")) {
            errorMessage = "This API key has been reported as leaked. Please use a new key.";
            statusCode = 403;
        }

        return jsonResponse({ error: errorMessage }, statusCode);
    }
};

export const config = {
    path: "/api/generate",
};
