"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { formatTimeRemaining } from "@/utils/room";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { format } from 'date-fns';
import { useRealtime } from "@/lib/realtime-client";
const Page = () => {
  const { username } = useUsername();
  const router = useRouter()
  const [copy, setCopy] = useState("COPY");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const params = useParams();
  const roomId = params.roomId as string;
 
  const {data:ttlData} = useQuery({
    queryKey:['ttl',roomId],
    queryFn:async ()=>{
      const res = await client.room.ttl.get({query:{roomId}})
      return res.data
    }
  })

  useEffect(()=>{
      if(ttlData?.ttl !== undefined){
        setTimeRemaining(ttlData.ttl)
      }
  },[ttlData])

  useEffect(()=>{
    if(timeRemaining === null || timeRemaining <=0) return;
    if(timeRemaining === 0){
      router.push('/?destroyed=true' )
      return
    }
    const interval = setInterval(()=>{
      setTimeRemaining((prev)=>{
        if(prev === null || prev <=1){
          clearInterval(interval)
          return 0
        }
        return prev -1
      })
    },1000)
    return ()=> clearInterval(interval)
  },[timeRemaining,router])

  const {data:messages,refetch}=useQuery({
    queryKey:['messages',roomId],
    queryFn:async ()=>{
      const res = await client.messages.get({query:{roomId}})
      return res.data
    }
  })

  const { mutate: sendMessage,isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await client.messages.post(
        {
          sender: username,
          text,
        },
        { query: { roomId } },

      );
      setInput("");
    },
  });
  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null,{ query: { roomId } });
    }
  })

  useRealtime({
      channels:[roomId],
      events:['chat.message','chat.destroy'],
      onData:({event})=>{
        if(event==='chat.message'){
           refetch()
        }
        if(event==='chat.destroy'){
          router.push('/?destroyed=true' )
        }
      }
    })

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopy("COPIED");
    setTimeout(() => {
      setCopy("COPY");
    }, 2000);
  };

  return (
    <main className="flex flex-col h-dvh overflow-hidden">
  {/* HEADER */}
  <header className="border-b border-zinc-800 p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-zinc-900/30">
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="flex flex-col">
        <span className="text-[10px] sm:text-xs text-zinc-500 uppercase">
          Room ID
        </span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-green-500 text-sm sm:text-base">
            {roomId}
          </span>
          <button
            onClick={copyLink}
            className="text-[9px] sm:text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {copy}
          </button>
        </div>
      </div>

      <div className="hidden sm:block h-8 w-px bg-zinc-800" />

      <div className="flex flex-col">
        <span className="text-[10px] sm:text-xs text-zinc-500 uppercase">
          Self destruct
        </span>
        <span
          className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${
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
      className="text-xs bg-zinc-800 hover:bg-red-600 px-3 py-2 rounded text-zinc-400 hover:text-white font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
    >
      💣 DESTROY NOW
    </button>
  </header>

  {/* MESSAGES */}
  <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-thin">
    {messages?.messages.length === 0 && (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500 text-xs sm:text-sm font-mono text-center">
          No messages yet, start the conversation
        </p>
      </div>
    )}

    {messages?.messages.map((msg) => (
      <div key={msg.id} className="flex flex-col items-start">
        <div className="max-w-[90%] sm:max-w-[80%]">
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
            <span className="text-[9px] text-zinc-600">
              {format(msg.timestamp, "HH:mm")}
            </span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed break-words">
            {msg.text}
          </p>
        </div>
      </div>
    ))}
  </div>

  {/* INPUT */}
  <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-900/30">
    <div className="flex gap-2 sm:gap-4">
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 animate-pulse">
          {">"}
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              sendMessage({ text: input.trim() });
              setInput("");
            }
          }}
          autoFocus
          type="text"
          placeholder="Type message..."
          className="w-full bg-black border border-zinc-800 focus:border-zinc-700 focus:outline-none text-zinc-100 placeholder:text-zinc-700 py-3 pl-7 pr-3 text-sm rounded"
        />
      </div>

      <button
        onClick={() => {
          sendMessage({ text: input });
          setInput("");
        }}
        disabled={!input.trim() || isPending}
        className="bg-zinc-800 text-zinc-300 px-4 sm:px-6 text-sm font-bold rounded transition-all hover:text-white disabled:opacity-50"
      >
        SEND
      </button>
    </div>
  </div>
</main>

  );
};

export default Page;
