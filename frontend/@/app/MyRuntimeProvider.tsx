// "use client";

// import type { ReactNode } from "react";
// import {
//   AssistantRuntimeProvider,
//   useLocalRuntime,
//   type ChatModelAdapter,
// } from "@assistant-ui/react";

// const MyModelAdapter: ChatModelAdapter = {
//   async run({ messages, abortSignal }) {
//     // TODO replace with your own API
//     const result = await fetch("http://localhost:8000/chat", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       // forward the messages in the chat to the API
//       body: JSON.stringify({
//         messages,
//       }),
//       // if the user hits the "cancel" button or escape keyboard key, cancel the request
//       signal: abortSignal,
//     });

//     const data = await result.json();
//     return {
//       content: [
//         {
//           type: "text",
//           text: data.text,
//         },
//       ],
//     };
//   },
// };

// export function MyRuntimeProvider({
//   children,
// }: Readonly<{
//   children: ReactNode;
// }>) {
//   const runtime = useLocalRuntime(MyModelAdapter);

//   return (
//     <AssistantRuntimeProvider runtime={runtime}>
//       {children}
//     </AssistantRuntimeProvider>
//   );
// }

"use client";

import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

const MyModelAdapter: ChatModelAdapter = {
  async run({ messages, abortSignal }) {
    // Using Fake Chat API for testing
    const result = await fetch("https://api.monkedev.com/fun/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msg: messages[messages.length - 1].content, // Send last message in the chat
        lang: "en", // Language
      }),
      signal: abortSignal,
    });

    const data = await result.json();
    return {
      content: [
        {
          type: "text",
          text: data.response, // The fake chat API responds with a "response" field
        },
      ],
    };
  },
};

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const runtime = useLocalRuntime(MyModelAdapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
