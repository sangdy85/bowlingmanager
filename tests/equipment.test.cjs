const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createRequire}=require('node:module'),ts=require('typescript'),{PrismaClient}=require('@prisma/client');
function load(relative,mocks={},cache=new Map()){
 const filename=path.resolve(__dirname,'..',relative);if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);const req=createRequire(filename),source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',source)(id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith('@/')?load('src/'+id.slice(2)+'.ts',mocks,cache):req(id),module,module.exports);return module.exports;
}
const meta={type:'INTRO',category:'BALL',brand:'가상 브랜드',model:'테스트 볼 A',link:'https://example.com/gear'};
test('equipment metadata enum, lengths and safe external links',()=>{
 const policy=load('src/lib/equipment.ts');assert.equal(policy.validateEquipment(meta).equipmentModel,'테스트 볼 A');
 for(const change of [{type:'ADMIN_OFFICIAL'},{category:'INVALID'},{model:''},{model:'x'.repeat(121)},{brand:'x'.repeat(61)}])assert.throws(()=>policy.validateEquipment({...meta,...change}));
 for(const link of ['javascript:alert(1)','data:text/html,x','//example.com','https://a:b@example.com','https://example.com\n/x','https:\\example.com'])assert.throws(()=>policy.validateEquipment({...meta,link}));
 assert.equal(policy.validateEquipment({...meta,brand:' ',link:''}).equipmentBrand,null);assert.equal(policy.validateEquipment({...meta,link:''}).equipmentLink,null);
});
test('actual shared community actions: member publishing, ownership, comments, reports, moderation, legacy data',async()=>{
 const root=path.resolve(__dirname,'..'),previous=JSON.parse(fs.readFileSync(path.join(root,'scratch/portal-test-environment.json'),'utf8'));
 assert(path.resolve(previous.directory).startsWith(path.join(root,'scratch')+path.sep),'only copy our test fixture');
 const dir=fs.mkdtempSync(path.join(root,'scratch','equipment-test-'));fs.copyFileSync(path.join(previous.directory,'test.db'),path.join(dir,'test.db'));
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:'file:../scratch/'+path.basename(dir)+'/test.db'},stdio:'pipe'});
 const url='file:'+path.join(dir,'test.db').replace(/\\/g,'/'),db=new PrismaClient({datasources:{db:{url}}});let session=null;const refreshed=[];
 const mocks={'@/auth':{auth:async()=>session},'@/lib/prisma':{__esModule:true,default:db},'next/cache':{revalidatePath:route=>refreshed.push(route)}};
 const equipment=load('src/app/actions/equipment.ts',mocks),community=load('src/app/actions/community.ts',mocks),query=load('src/lib/equipment-server.ts',mocks);
 try{
  const author=await db.user.findUnique({where:{email:'portal-author@example.test'}}),reader=await db.user.findUnique({where:{email:'portal-reader@example.test'}}),admin=await db.user.findUnique({where:{email:'portal-admin@example.test'}});
  const input={title:'가상 예시 · 테스트 볼 A 소개',content:'이 제품은 로컬 QA를 위한 가상 모델입니다. 실제 제품 사양이나 성능을 뜻하지 않습니다.',equipment:meta};
  const originalScores=await db.score.count(),originalTournaments=await db.tournament.count();
  assert((await equipment.saveEquipmentPost(null,input)).error);
  session={user:{id:author.id,role:'USER'}};
  await db.communityPost.updateMany({where:{authorId:author.id},data:{createdAt:new Date(Date.now()-120000)}});
  assert((await equipment.saveEquipmentPost(null,{...input,equipment:{...meta,link:'javascript:alert(1)'}})).error);
  await assert.rejects(()=>community.saveCommunityPost(null,{category:'FREE',title:input.title,content:input.content,equipment:meta}),/용품 정보/);
  const created=await equipment.saveEquipmentPost(null,input);assert(created.id);let row=await query.publishedEquipment(created.id);assert.equal(row.category,'EQUIPMENT');assert.equal(row.equipmentType,'INTRO');assert.equal(row.authorId,author.id);
  assert((await equipment.saveEquipmentPost(null,input)).error,'shared posting cooldown applies');
  session={user:{id:reader.id,role:'SUPER_ADMIN'}};
  assert((await equipment.saveEquipmentPost(created.id,input)).error,'session role cannot grant ownership');
  await assert.rejects(()=>community.deleteCommunityPost(created.id),/권한/);await assert.rejects(()=>community.moderateCommunityPost(created.id,true),/관리자/);
  await community.addCommunityComment(created.id,'같은 용품 글에 연결되는 검증용 댓글입니다.');assert.equal((await query.publishedEquipment(created.id)).comments.length,1);
  await community.reportCommunityPost(created.id,'가상 검증용 신고 내용');await community.reportCommunityPost(created.id,'중복 신고 검증 내용');assert.equal(await db.communityReport.count({where:{postId:created.id,authorId:reader.id}}),1);
  session={user:{id:author.id}};
  await community.saveCommunityPost(created.id,{category:'EQUIPMENT',title:input.title,content:'기존 커뮤니티 편집을 통해 수정한 가상 설명입니다.'});assert.equal((await query.publishedEquipment(created.id)).equipmentModel,meta.model,'ordinary editing preserves metadata');
  const updated=await equipment.saveEquipmentPost(created.id,{...input,equipment:{...meta,model:'테스트 볼 A · 개정'}});assert.equal(updated.id,created.id);
  session={user:{id:admin.id}};await community.moderateCommunityPost(created.id,true);assert.equal(await query.publishedEquipment(created.id),null);assert.equal(await db.communityPost.count({where:query.publicEquipmentWhere('테스트 볼 A')}),0);
  session={user:{id:reader.id}};await assert.rejects(()=>community.addCommunityComment(created.id,'숨김 글 댓글 검증'),/작성할 수 없는/);
  session={user:{id:admin.id}};await community.moderateCommunityPost(created.id,false);
  const review=await equipment.saveEquipmentPost(null,{title:'가상 예시 · 테스트 볼링화 사용 후기',content:'별도 로컬 테스트에서 작성한 가상 후기입니다. 실제 사용 경험이나 실제 추천을 뜻하지 않습니다.',equipment:{type:'REVIEW',category:'SHOES',brand:'가상 브랜드',model:'테스트 슈즈 B',link:''}});assert(review.id);
  const legacy=await db.communityPost.create({data:{category:'EQUIPMENT',title:'메타데이터 없는 기존 용품 이야기',content:'기존 커뮤니티 글을 위한 가상 검증 데이터입니다.',authorId:reader.id}});
  assert((await query.publishedEquipment(legacy.id)).equipmentModel===null);assert.equal(await db.communityPost.count({where:query.publicEquipmentWhere()}),3);
  assert.equal(await db.communityPost.count({where:query.publicEquipmentWhere('','SHOES','REVIEW')}),1);assert.equal(await db.communityPost.count({where:query.publicEquipmentWhere('개정','BALL','INTRO')}),1);
  session={user:{id:reader.id}};await community.saveCommunityPost(legacy.id,{category:'FREE',title:legacy.title,content:legacy.content});assert.equal(await query.publishedEquipment(legacy.id),null);
  const disposable=await db.communityPost.create({data:{category:'EQUIPMENT',title:'삭제 정책 검증용 가상 글',content:'소프트 삭제 정책을 확인하는 검증용 글입니다.',authorId:reader.id}});await community.deleteCommunityPost(disposable.id);assert.equal(await query.publishedEquipment(disposable.id),null);assert.equal((await db.communityPost.findUnique({where:{id:disposable.id}})).status,'DELETED');
  assert.equal(await db.score.count(),originalScores);assert.equal(await db.tournament.count(),originalTournaments);
  assert(refreshed.includes('/equipment'));assert(refreshed.includes('/equipment/'+created.id));
  const hidden=await db.communityPost.create({data:{category:'EQUIPMENT',title:'비공개 용품 검증 글',content:'숨김 처리된 테스트 글이며 공개되지 않아야 합니다.',status:'HIDDEN',authorId:author.id}});
  const info={...previous,directory:dir,databaseUrl:url,equipmentId:created.id,equipmentReviewId:review.id,hiddenEquipmentId:hidden.id,deletedEquipmentId:disposable.id};
  fs.writeFileSync(path.join(root,'scratch/portal-test-environment.json'),JSON.stringify(info,null,2));console.log('Equipment isolated fixture ready; competition/community records preserved.');
 }finally{await db.$disconnect();}
});
