import { ENV } from "./_core/env";

type LlmMessage = { role: "system" | "user"; content: unknown };

export async function requestStructuredLlm(input: {
  messages: LlmMessage[];
  model?: string;
  schemaName?: string;
  schema?: Record<string, unknown>;
  response_format?: Record<string, unknown>;
}) {
  if (!ENV.llmApiKey)
    throw new Error(
      "AI extraction is not configured. Set LLM_API_KEY on the server."
    );
  let lastError = "AI provider request failed.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${ENV.llmBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.llmApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model ?? ENV.llmModel,
          messages: input.messages,
          response_format: input.response_format ?? {
            type: "json_schema",
            json_schema: {
              name: input.schemaName ?? "structured_response",
              strict: true,
              schema: input.schema ?? {},
            },
          },
          temperature: 0,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        lastError = `AI provider request failed (${response.status}).`;
        if (response.status < 500 && response.status !== 429)
          throw new Error(lastError);
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      const body = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string | Array<{ text?: string }> };
        }>;
      };
      const content = body.choices?.[0]?.message?.content;
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.map(part => part.text ?? "").join("")
            : "";
      if (!text)
        throw new Error("The AI provider returned no structured content.");
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      if (
        attempt === 1 ||
        /provider request failed \((4\d\d)\)/.test(lastError)
      )
        throw new Error(lastError);
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error(lastError);
}
