import { loadEnvConfig } from '@next/env';
import { POST as inspect } from '../app/api/inspect/route';
import { POST as appeal, DELETE as clear } from '../app/api/appeal/route';
loadEnvConfig(process.cwd());
async function main(){
 const photo=await fetch('https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=640&q=80&fm=jpg');
 if(!photo.ok)throw new Error('Test photo download failed.');
 const form=new FormData();form.append('image',new Blob([await photo.arrayBuffer()],{type:'image/jpeg'}),'chair-test.jpg');
 const initial=await inspect(new Request('http://localhost/api/inspect',{method:'POST',body:form}));
 const body=await initial.json();
 console.log('Inspection HTTP status:',initial.status);
 if(!initial.ok){console.log(body.error);process.exitCode=1;return;}
 console.log('Image report:',JSON.stringify(body.report));
 try {for(const [turn,objection] of ['That is clearly a chair. Explain why the visible seat and backrest do not count.','Look at the legs again. Your last explanation does not prove it is a table.'].entries()){
  const res=await appeal(new Request('http://localhost/api/appeal',{method:'POST',body:JSON.stringify({caseId:body.caseId,turn,objection})}));
  console.log('Objection',turn+1,'HTTP status:',res.status);const result=await res.json();console.log(res.ok?result.response:result.error);if(!res.ok){process.exitCode=1;break;}
 }}finally{await clear(new Request('http://localhost/api/appeal',{method:'DELETE',body:JSON.stringify({caseId:body.caseId})}));}
}
main().catch(()=>{console.error('Live verification failed before completing. No credentials were logged.');process.exitCode=1;});
