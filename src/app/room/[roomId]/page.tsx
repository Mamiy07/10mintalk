"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { formatTimeRemaining } from "@/utils/room";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

const Page = () => {
  const { username } = useUsername();
  const [copy, setCopy] = useState("COPY");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const params = useParams();
  const roomId = params.roomId as string;
  const { mutate: sendMessage,isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await client.messages.post(
        {
          sender: username,
          text,
        },
        { query: { roomId } },
      );
    },
  });
  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopy("COPIED");
    setTimeout(() => {
      setCopy("COPY");
    }, 2000);
  };

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/30">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">Room ID</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-500">{roomId}</span>
              <button
                onClick={copyLink}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {copy}
              </button>
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">
              Self distruct
            </span>
            <span
              className={`text-sm font-bold flex items-center gap-2 ${timeRemaining !== null && timeRemaining < 60 ? "text-red-500" : "text-amber-500"}`}
            >
              {timeRemaining !== null
                ? formatTimeRemaining(timeRemaining)
                : "--:--"}
            </span>
          </div>
        </div>

        <button className="text-xs bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all flex items-center gap-2 disabled:opacity-50">
          {" "}
          <span className="group-hover:animate-pulse">💣</span> DESTROY NOW
        </button>
      </header>
      <div className="flex-1 overflow-y-hidden p-4"></div>
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex gap-4">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 animate-pulse">
              {">"}
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  //SEND MESSAGE TO BE
                  sendMessage({ text: input.trim() });
                  inputRef.current?.focus();
                }
              }}
              autoFocus
              type="text"
              placeholder="Type message..."
              className="w-full bg-black border-zinc-800 focus:border-zinc-700 focus:outline-none transition-colors text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm"
            />
          </div>
          <button
            onClick={() => {
              sendMessage({ text: input});
              inputRef.current?.focus();
            }}
            disabled={!input.trim() || isPending}
            className="bg-zinc-800 text-zinc-400 px-6 text-sm font-bold transition-all hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  );
};

export default Page;
