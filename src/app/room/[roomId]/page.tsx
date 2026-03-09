"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { nanoid } from "nanoid";
import { formatTimeRemaining } from "@/utils/room";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useRealtime } from "@/lib/realtime-client";

type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  roomId: string;
  pending?: boolean;
  failed?: boolean;
};

const Page = () => {
  const { username } = useUsername();
  const router = useRouter();

  const [copy, setCopy] = useState("COPY");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  const params = useParams();
  const roomId = params.roomId as string;

  /* ---------------- TTL ---------------- */

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({ query: { roomId } });
      return res.data;
    },
  });

  useEffect(() => {
    if (ttlData?.ttl !== undefined) {
      setTimeRemaining(ttlData.ttl);
    }
  }, [ttlData]);

  /* ---------------- DESTROY ROOM ---------------- */

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } });
    },
    onSuccess: () => {
      router.replace("/?destroyed=true");
    },
  });

  /* ---------------- TIMER ---------------- */

  useEffect(() => {
    if (timeRemaining === null) return;

    if (timeRemaining === 0) {
      destroyRoom();
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, destroyRoom]);

  /* ---------------- FETCH MESSAGES ---------------- */

  const { isLoading } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } });
      setMessages(res.data?.messages ?? []);
      return res.data;
    },
  });

  /* ---------------- SEND MESSAGE ---------------- */

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      const tempId = nanoid();

      const optimistic: Message = {
        id: tempId,
        sender: username,
        text,
        timestamp: Date.now(),
        roomId,
        pending: true,
      };

      setMessages((prev) => [...prev, optimistic]);

      setInput("");

      try {
        await client.messages.post(
          { sender: username, text },
          { query: { roomId } }
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, failed: true } : m
          )
        );
      }
    },
  });

  /* ---------------- REALTIME ---------------- */

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy"],
    onData: ({ event, data }) => {
      if (event === "chat.message") {
        setMessages((prev) => {
          // remove matching optimistic message
          const filtered = prev.filter(
            (m) =>
              !(
                m.pending &&
                m.sender === data.sender &&
                m.text === data.text
              )
          );

          // prevent duplicates
          if (filtered.find((m) => m.id === data.id)) return filtered;

          return [...filtered, data];
        });
      }

      if (event === "chat.destroy") {
        router.replace("/?destroyed=true");
      }
    },
  });

  /* ---------------- AUTO SCROLL ---------------- */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------------- COPY LINK ---------------- */

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);

    setCopy("COPIED");

    setTimeout(() => {
      setCopy("COPY");
    }, 2000);
  };

  /* ---------------- UI ---------------- */

  return (
    <main className="flex flex-col h-dvh overflow-hidden">

      {/* HEADER */}

      <header className="border-b border-zinc-800 p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-zinc-800 dark:bg-zinc-900/30">

        <div className="flex items-center gap-3 sm:gap-4">

          <div className="flex flex-col">
            <span className="text-[10px] sm:text-xs text-white uppercase">
              Room ID
            </span>

            <div className="flex items-center gap-2">
              <span className="font-bold text-green-500 text-sm sm:text-base">
                {roomId}
              </span>

              <button
                onClick={copyLink}
                className="text-[9px] sm:text-[10px] bg-zinc-950 hover:bg-zinc-700 px-2 py-0.5 rounded text-white"
              >
                {copy}
              </button>
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-zinc-800" />

          <div className="flex flex-col">
            <span className="text-[10px] sm:text-xs text-white uppercase">
              Self destruct
            </span>

            <span
              className={`text-xs sm:text-sm font-bold ${
                timeRemaining !== null && timeRemaining < 60
                  ? "text-red-500"
                  : "text-amber-500"
              }`}
            >
              {timeRemaining !== null
                ? formatTimeRemaining(timeRemaining)
                : "--:--"}
            </span>
          </div>
        </div>

        <button
          onClick={() => destroyRoom()}
          className="text-xs bg-zinc-950 hover:bg-red-600 px-3 py-2 rounded text-white font-bold"
        >
          💣 DESTROY NOW
        </button>

      </header>

      {/* MESSAGES */}

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-500 text-xs sm:text-sm font-mono">
              No messages yet
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>

            <div className="flex items-baseline gap-2 mb-1">
              <span
                className={`text-[11px] font-bold ${
                  msg.sender === username
                    ? "text-green-500"
                    : "text-blue-500"
                }`}
              >
                {msg.sender === username ? "You" : msg.sender}
              </span>

              <span className="text-[9px] text-zinc-500">
                {format(new Date(msg.timestamp), "HH:mm")}
              </span>
            </div>

            <p className="text-sm dark:text-zinc-300 break-words">
              {msg.text}
            </p>

          </div>
        ))}

        <div ref={bottomRef} />

      </div>

      {/* INPUT */}

      <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-800 dark:bg-zinc-900/30">

        <div className="flex gap-2 sm:gap-4">

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                sendMessage({ text: input.trim() });
              }
            }}
            type="text"
            placeholder="Type message..."
            className="flex-1 bg-white dark:bg-black border border-zinc-800 px-3 py-3 text-sm rounded"
          />

          <button
            onClick={() => {
              if (!input.trim()) return;
              sendMessage({ text: input.trim() });
            }}
            disabled={!input.trim() || isPending}
            className="bg-white dark:bg-zinc-800 px-4 sm:px-6 text-sm font-bold rounded"
          >
            SEND
          </button>

        </div>

      </div>

    </main>
  );
};

export default Page;