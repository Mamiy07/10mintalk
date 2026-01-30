import { createRoom } from '@/utils/room'
import { Elysia} from 'elysia'
import { authMiddleware } from './auth'
import { z } from 'zod'
import { redis } from '@/lib/redis'
import { Message, realtime } from '@/lib/realtime'
import { nanoid } from 'nanoid'


const rooms = new Elysia({prefix:'/room'}).
post('/create', createRoom)

const messages = new Elysia({prefix:'/messages'}).use(authMiddleware).post('/',async ({body , auth})=>{
    const {sender , text} = body 
const roomExists = await redis.exists(`meta:${auth.roomId}`)

    if(!roomExists){
        throw new Error("Room does not exist")
    }
    
    const message:Message = {
        id:nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId: auth.roomId,
        
    }

    await redis.rpush(`messages:${auth.roomId}`,{...message,token:auth.token})
    await realtime.channel(auth.roomId).emit('chat.message',message)
   
    const remaning = await redis.ttl(`meta:${auth.roomId}`)
    await redis.expire(`messages:${auth.roomId}`, remaning)
    await redis.expire(`history:${auth.roomId}`, remaning)
    await redis.expire(auth.roomId, remaning)

  
},{ query:z.object({ roomId: z.string()}),   
    body:z.object({
      sender: z.string().max(100),
      text: z.string().max(1000)
}) }
    )

const app = new Elysia({ prefix: '/api' }).use(rooms).use(messages)
 
    

export const GET = app.fetch 
export const POST = app.fetch 
export type App = typeof app