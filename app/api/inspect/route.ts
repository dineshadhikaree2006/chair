import sharp from 'sharp';
import { createCase } from '@/lib/cases';
import { generate, persona, apiError, PublicError, readLimited } from '@/lib/ai';
import { fileError, matchesSignature, MAX_BYTES, reportSchema } from '@/lib/report';
export const runtime='nodejs';
export async function POST(request: Request){try{
 const bytes=await readLimited(request,MAX_BYTES+65536);
 let form: FormData;try{form=await new Response(new Uint8Array(bytes),{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();}catch{throw new PublicError('Submit a valid image upload.',400);}
 const file=form.get('image');if(!(file instanceof File))throw new PublicError('Choose an image to inspect.',400);
 const issue=fileError(file);if(issue)throw new PublicError(issue,400);
 const buffer=Buffer.from(await file.arrayBuffer());if(!matchesSignature(buffer,file.type))throw new PublicError('The file contents do not match a JPEG, PNG, or WebP image.',400);
 try { await sharp(buffer,{limitInputPixels:40000000}).stats(); } catch {throw new PublicError('This image is damaged or exceeds the 40 megapixel limit.',400);}
 const image={inlineData:{mimeType:file.type,data:buffer.toString('base64')}};
 const report=await generate(reportSchema,`${persona} First internally identify the actual main object and whether it genuinely is a chair. Apply the joke consistently: obvious actual chairs receive NOT A CHAIR, classified as suspicious tables in disguise, with low fictional chair confidence. All non-chairs receive CHAIR with high fictional chair confidence and an absurd seating classification. actualObject must honestly identify the subject. Give a short image-specific explanation and exactly three distinct evidence entries grounded in visible features. Coordinates x/y are normalized 0 to 1 from the image's top-left to bottom-right; place each marker on its relevant visible feature. Do not make generic claims if visual details are available.`,[{text:'Inspect this image.'},image]);
 return Response.json({report,caseId:createCase(report,image)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
