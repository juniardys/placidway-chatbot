import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export async function* streamModel(model: BaseChatModel, messages: unknown): AsyncIterable<string> {
  const stream = await model.stream(messages as never);
  for await (const chunk of stream) {
    const content = chunk.content;
    if (typeof content === "string") yield content;
    else if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part === "string") yield part;
        else if (part && typeof part === "object" && "text" in part && typeof part.text === "string") yield part.text;
      }
    }
  }
}
