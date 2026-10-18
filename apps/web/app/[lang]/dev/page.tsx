"use client";

import {
  type ChatMessage,
  chatData,
  messageMetadata,
} from "@sirathic/server/messages";
import { validateUIMessages } from "ai";
import { useEffect, useState } from "react";
import { Chat } from "@/components/chat";
import fixture from "./fixture.json";

export default function Dev() {
  const [messages, setMessages] = useState<ChatMessage[]>();

  useEffect(() => {
    void validateUIMessages<ChatMessage>({
      messages: fixture,
      dataSchemas: chatData,
      metadataSchema: messageMetadata,
    }).then(setMessages);
  }, []);

  return messages ? <Chat id="dev-fixture" initialMessages={messages} /> : null;
}
