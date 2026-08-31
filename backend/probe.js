const Module=require("module"); const orig=Module.prototype.require;
let seq={};const id=p=>{seq[p]=(seq[p]||0)+1;return p+seq[p];};
const db={users:[],profiles:[],docs:[]};
const find=(a,f)=>a.find(f)||null;
const docsFor=pid=>db.docs.filter(d=>d.profileId===pid);
const P={prisma:{
  $queryRaw:async()=>1,
  user:{findUnique:async({where})=>find(db.users,u=>u.phone===where.phone||u.id===where.id),create:async({data})=>{const u={id:id("u"),roles:["DRIVER"],...data};db.users.push(u);return u;},update:async({where,data})=>{const u=find(db.users,x=>x.id===where.id);Object.assign(u,data);return u;}},
  driverProfile:{findUnique:async({where,include})=>{const p=find(db.profiles,p=>p.userId===where.userId||p.id===where.id);if(!p)return null;return include?.documents?{...p,documents:docsFor(p.id)}:p;},create:async({data,include})=>{const p={id:id("p"),...data};db.profiles.push(p);return include?.documents?{...p,documents:[]}:p;},update:async({where,data})=>{const p=find(db.profiles,x=>x.userId===where.userId||x.id===where.id);Object.assign(p,data);return p;}},
  driverDocument:{create:async({data})=>{const d={id:id("d"),status:"PENDING",...data};db.docs.push(d);return d;},update:async({where,data})=>{const d=find(db.docs,x=>x.id===where.id);Object.assign(d,data);return d;}},
}};
Module.prototype.require=function(m){
  if(m.endsWith("/prisma")||m==="../prisma")return P;
  if(m.endsWith("/realtime")||m==="../realtime")return{init:()=>{},emitToUser:()=>{},io:{to:()=>({emit:()=>{}})}};
  if(m.endsWith("/push"))return{sendToUser:async()=>{}};
  if(m.endsWith("/storage"))return{saveBuffer:async(buf,ext)=>"https://cdn/doc."+ext,UPLOAD_DIR:"/tmp/uploads"};
  if(m.endsWith("/client")&&m.includes("."))return{complete:async()=>"{}",MODEL:"t"};
  return orig.apply(this,arguments);
};
process.env.ENABLED_COUNTRIES="KE";process.env.DEFAULT_COUNTRY="KE";process.env.JWT_SECRET="test";process.env.ANTHROPIC_API_KEY="test";process.env.UPLOAD_DIR="/tmp/uploads";
process.on("unhandledRejection",e=>{console.log("UNHANDLED:",e.message);});
require("./src/index.js");
const base="http://localhost:4000",j=r=>r.json();
async function mk(phone,role){const o=await j(await fetch(base+"/auth/request-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone,country:"KE"})}));return j(await fetch(base+"/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone,code:o.devCode,role,country:"KE"})}));}
setTimeout(async()=>{try{
  const drv=await mk("+254713000001","DRIVER");
  console.log("driver token?",!!drv.token);
  const r=await fetch(base+"/driver/documents",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+drv.token},body:JSON.stringify({type:"DRIVERS_LICENSE",base64:"AAAABBBBCCCCDDDD",ext:"jpg"})});
  console.log("doc upload status:",r.status);
  console.log("doc upload body:",JSON.stringify(await r.json()));
}catch(e){console.log("CATCH:",e.message);}process.exit(0);},1000);
