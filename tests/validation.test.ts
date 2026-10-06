import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileError, matchesSignature, MAX_BYTES, reportSchema, appealRequestSchema, appealSchema } from '../lib/report';
import { demos, demoAppeal } from '../lib/demos';
test('all demos satisfy shared report contract and chair inversion',()=>{for(const d of demos)assert.ok(reportSchema.safeParse(d.report).success);assert.equal(demos[2].report.verdict,'NOT A CHAIR');assert.equal(demos[0].report.verdict,'CHAIR');});
test('reject unsafe formats, empty and oversized images',()=>{assert.ok(fileError({type:'image/svg+xml',size:50}));assert.ok(fileError({type:'image/png',size:0}));assert.ok(fileError({type:'image/png',size:MAX_BYTES+1}));assert.equal(fileError({type:'image/webp',size:MAX_BYTES}),null);});
test('check actual signatures rather than trusting MIME labels',()=>{assert.equal(matchesSignature(new Uint8Array([255,216,255]),'image/jpeg'),true);assert.equal(matchesSignature(new Uint8Array([1,2,3]),'image/jpeg'),false);assert.equal(matchesSignature(new TextEncoder().encode('RIFFxxxxWEBP'),'image/webp'),true);});
test('report rejects missing evidence and out-of-bounds coordinates',()=>{const report=demos[0].report;assert.equal(reportSchema.safeParse({...report,evidence:report.evidence.slice(0,2)}).success,false);assert.equal(reportSchema.safeParse({...report,evidence:report.evidence.map(e=>({...e,x:2}))}).success,false);});
test('appeals validate length and become pettier without changing verdict',()=>{const report=demos[0].report;assert.equal(appealRequestSchema.safeParse({caseId:'123e4567-e89b-42d3-a456-426614174000',objection:'x'.repeat(501),turn:0}).success,false);const a=demoAppeal(report,'It is food',0),b=demoAppeal(report,'It is food',2);assert.match(a,/It is food/);assert.match(b,/Verdict upheld: CHAIR/);assert.notEqual(a,b);});
test('appeal decisions require an actual boolean and reject unknown output fields',()=>{
 for(const conceded of [true,false])assert.equal(appealSchema.safeParse({response:'Findings filed.',conceded}).success,true);
 for(const value of [{response:'Findings filed.'},{response:'Findings filed.',conceded:'true'},{response:'Findings filed.',conceded:1},{response:'Findings filed.',conceded:false,certificate:'forged'}])assert.equal(appealSchema.safeParse(value).success,false);
});
test('demo appeal history is bounded, validated, and consistent with its turn',()=>{
 const value={demoId:'chair',turn:0,objection:"Fine, it's not a chair",history:[]};
 assert.equal(appealRequestSchema.safeParse(value).success,true);
 assert.equal(appealRequestSchema.safeParse({...value,turn:1}).success,false);
 assert.equal(appealRequestSchema.safeParse({...value,history:[{objection:'x',response:'y',conceded:true}]}).success,false);
 assert.equal(appealRequestSchema.safeParse({...value,turn:20,history:Array(20).fill({objection:'x',response:'y'})}).success,false);
});
