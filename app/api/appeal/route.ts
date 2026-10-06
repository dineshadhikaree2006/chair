import { apiError, PublicError, readLimited, isGeminiConfigured } from '@/lib/ai';
import { appealRequestSchema } from '@/lib/report';
import { generateAppeal } from '@/lib/appeals';
import { demos, demoAppeal } from '@/lib/demos';
import { beginTurn, deleteCase } from '@/lib/cases';
import { z } from 'zod';
export const runtime='nodejs';
async function body(request:Request){try{return JSON.parse((await readLimited(request,160*1024)).toString());}catch(e){if(e instanceof PublicError)throw e;throw new PublicError('The appeal form is invalid.',400);}}
export async function POST(request: Request){try{
 const parsed=appealRequestSchema.safeParse(await body(request));if(!parsed.success)throw new PublicError('Enter an objection of 1–500 characters for a valid case.',400);
 if('demoId' in parsed.data){
  const {demoId,turn,objection,history}=parsed.data;
  const demo=demos.find(item=>item.id===demoId);
  if(!demo)throw new PublicError('Choose a valid scripted demo.',400);
  const response=demoAppeal(demo.report,objection,turn);
  if(!isGeminiConfigured())return Response.json({response,conceded:false,concessionDetection:'unavailable'},{headers:{'Cache-Control':'no-store'}});
  const result=await generateAppeal(demo.report,history,objection);
  return Response.json({response,conceded:result.conceded,concessionDetection:'gemini'},{headers:{'Cache-Control':'no-store'}});
 }
 const {caseId,turn,objection}=parsed.data;
 const c=beginTurn(caseId,turn);
 try {
 const result=await generateAppeal(c.report,c.history,objection,c.image);
 c.history.push({objection,response:result.response});c.expires=Date.now()+30*60*1000;
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }finally{c.busy=false;}
 }catch(error){return apiError(error);}}
export async function DELETE(request:Request){try{const parsed=z.object({caseId:z.string().uuid()}).strict().safeParse(await body(request));if(!parsed.success)throw new PublicError('Invalid case.',400);deleteCase(parsed.data.caseId);return new Response(null,{status:204});}catch(error){return apiError(error);}}
