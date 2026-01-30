import { ANIMALS, ROOM_TTL_SECONDS } from "@/constants"
import { redis } from "@/lib/redis"
import { nanoid } from "nanoid"

export  function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2,'0')}`
}

export async function createRoom() {
    const roomId = nanoid()
        await redis.hset(`meta:${roomId}`,{
            connected:[],
            createdAt : Date.now()
        })
        await redis.expire(`meta:${roomId}`,ROOM_TTL_SECONDS)
    
        return { roomId }
    }

export const generateUsername = ()=>{
   const word = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
   return `anonymous-${word}-${nanoid(5)}`
}
