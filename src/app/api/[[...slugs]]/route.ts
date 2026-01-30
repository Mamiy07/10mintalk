import { createRoom } from '@/utils/room'
import { Elysia} from 'elysia'
import { authMiddleware } from './auth'
import { z } from 'zod'
import { redis } from '@/lib/redis'
import { Message, realtime } from '@/lib/realtime'
import { nanoid } from 'nanoid'


const rooms = new Elysia({prefix:'/room'}).
post('/create', createRoom).use(authMiddleware).get('/ttl',async ({auth})=>{
   const ttl = await redis.ttl(`meta:${auth.roomId}`)
   return {ttl:ttl>0 ? ttl : 0}
},{ query:z.object({   roomId: z.string() })}).delete("/",async ({auth})=>{
   
    await realtime.channel(auth.roomId).emit('chat.destroy',{isDestroyed:true})
   await Promise.all([
      redis.del(auth.roomId),
      redis.del(`meta:${auth.roomId}`),
      redis.del(`messages:${auth.roomId}`)
   ])
},{ query:z.object({ roomId: z.string()})})

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
    await redis.expire(auth.roomId, remaning)

  
},{ query:z.object({ roomId: z.string()}),   
    body:z.object({
      sender: z.string().max(100),
      text: z.string().max(1000)
}) }
    ).get('/',async({auth})=>{
        const messages = await redis.lrange<Message>(`messages:${auth.roomId}`,0,-1)
        return {messages:messages.map((m)=>({
            ...m,
            token:m.token === auth.token ? auth.token : undefined
        }))}
    },{ query:z.object({ roomId: z.string()})})

const app = new Elysia({ prefix: '/api' }).use(rooms).use(messages)
 
    
export const DELETE = app.fetch
export const GET = app.fetch 
export const POST = app.fetch 
export type App = typeof app