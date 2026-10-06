import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Part } from '@google/genai';
import type { Report } from './report';
import { PublicError } from './ai';
type Case = { report: Report; image: Part; history: {objection:string;response:string}[]; expires:number; busy:boolean };
// A bounded local-server store. The random case ID is a private bearer capability.
const root = globalThis as typeof globalThis & { chairCases?: Map<string,Case> };
const cases = root.chairCases ??= new Map<string,Case>();
function prune(){for(const [id,c] of cases)if(c.expires<Date.now()&&!c.busy)cases.delete(id);}
const cleanup=setInterval(prune,60000);cleanup.unref();
export function createCase(report:Report,image:Part){
 prune();
 if(cases.size>=20)throw new PublicError('The case cabinet is full. Wait for an old case to expire and retry.',503);
 const id=randomUUID();cases.set(id,{report,image,history:[],expires:Date.now()+30*60*1000,busy:false});return id;
}
export function getCase(id:string){prune();const c=cases.get(id);if(!c)throw new PublicError('This case expired or the server restarted. Inspect your photo again.',410);return c;}
export function deleteCase(id:string){cases.delete(id);}
export function beginTurn(id:string,turn:number){const c=getCase(id);if(c.busy)throw new PublicError('An objection is already being processed.',409);if(c.history.length>=20)throw new PublicError('This case has reached its 20-objection limit.',400);if(turn!==c.history.length)throw new PublicError('This objection was already sent or the conversation is out of date.',409);c.busy=true;return c;}
