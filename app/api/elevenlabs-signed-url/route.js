/**
 * Server-side route to generate a signed URL for ElevenLabs Conversational AI.
 * This keeps the API key secret on the server.
 *
 * GET /api/elevenlabs-signed-url
 */
export async function GET() {
  try {
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!agentId || !apiKey) {
      return Response.json(
        { error: "ElevenLabs credentials not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: "GET",
        headers: { "xi-api-key": apiKey },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ElevenLabs] Signed URL error:", response.status, errText);
      return Response.json(
        { error: `ElevenLabs API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error("[ElevenLabs] Error:", error?.message || error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
