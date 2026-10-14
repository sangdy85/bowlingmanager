const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),ts=require('typescript'),{PrismaClient}=require('@prisma/client');
function load(relative,mocks={},cache=new Map()){
 const filename=path.resolve(__dirname,'..',relative);if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);const req=createRequire(filename),source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',source)(id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith('@/')?load('src/'+id.slice(2)+'.ts',mocks,cache):req(id),module,module.exports);return module.exports;
}
test('community activity filters and comment edits use actual server actions and isolated DB',async()=>{
 const root=path.resolve(__dirname,'..'),previous=JSON.parse(fs.readFileSync(path.join(root,'scratch/portal-test-environment.json'),'utf8'));
 assert(path.resolve(previous.directory).startsWith(path.join(root,'scratch')+path.sep));
 const dir=fs.mkdtempSync(path.join(root,'scratch','community-hub-test-'));fs.copyFileSync(path.join(previous.directory,'test.db'),path.join(dir,'test.db'));
 const url='file:'+path.join(dir,'test.db').replace(/\\/g,'/');const db=new PrismaClient({datasources:{db:{url}}});let session=null;
 const mocks={'@/auth':{auth:async()=>session},'@/lib/prisma':{__esModule:true,default:db},'next/cache':{revalidatePath(){}}};
 const action=load('src/app/actions/community.ts',mocks),policy=load('src/lib/community-server.ts',mocks);
 try{
 const author=await db.user.findUnique({where:{email:'portal-author@example.test'}}),reader=await db.user.findUnique({where:{email:'portal-reader@example.test'}}),admin=await db.user.findUnique({where:{email:'portal-admin@example.test'}});
 const post=await db.communityPost.create({data:{category:'QUESTION',title:'QA · 볼링 연습 질문 · '+path.basename(dir),content:'로컬 테스트용 가상 질문입니다. 실제 운영 게시글이 아닙니다.',authorId:author.id}});
 const comment=await db.communityComment.create({data:{postId:post.id,authorId:reader.id,content:'로컬 QA 댓글입니다.'}});
 assert.equal(await db.communityPost.count({where:policy.publicCommunityWhere({scope:'mine'})}),0);
 assert.equal(await db.communityPost.count({where:policy.publicCommunityWhere({scope:'commented'})}),0);
 assert.equal(await db.communityPost.count({where:{AND:[policy.publicCommunityWhere({scope:'mine',userId:reader.id}),{id:post.id}]}}),0);
 assert.equal(await db.communityPost.count({where:{AND:[policy.publicCommunityWhere({scope:'mine',userId:author.id}),{id:post.id}]}}),1);
 assert.equal(await db.communityPost.count({where:{AND:[policy.publicCommunityWhere({scope:'commented',userId:reader.id}),{id:post.id}]}}),1);
 assert.equal(await db.communityPost.count({where:policy.publicCommunityWhere({category:'FREE',q:'QA · 볼링 연습 질문'})}),0);
 await assert.rejects(()=>action.updateCommunityComment(comment.id,'비로그인 수정',comment.updatedAt.toISOString()),/로그인/);
 session={user:{id:author.id,role:'SUPER_ADMIN'}};await assert.rejects(()=>action.updateCommunityComment(comment.id,'위조 관리자 수정',comment.updatedAt.toISOString()),/권한/);
 session={user:{id:reader.id}};
 for(const [value,version] of [[' ',comment.updatedAt.toISOString()],['x'.repeat(2001),comment.updatedAt.toISOString()],['정상 내용','invalid']])await assert.rejects(()=>action.updateCommunityComment(comment.id,value,version),/입력/);
 await action.updateCommunityComment(comment.id,'로컬 QA 댓글 수정 성공',comment.updatedAt.toISOString());
 let edited=await db.communityComment.findUnique({where:{id:comment.id}});assert.equal(edited.content,'로컬 QA 댓글 수정 성공');assert(edited.updatedAt>comment.updatedAt);
 await assert.rejects(()=>action.updateCommunityComment(comment.id,'늦은 요청 덮어쓰기',comment.updatedAt.toISOString()),/변경/);
 assert.equal((await db.communityComment.findUnique({where:{id:comment.id}})).content,edited.content);
 await assert.rejects(()=>action.updateCommunityComment('missing','없는 댓글 수정',edited.updatedAt.toISOString()),/권한/);
 await db.communityPost.update({where:{id:post.id},data:{status:'HIDDEN'}});
 await assert.rejects(()=>action.updateCommunityComment(comment.id,'숨김 글 댓글 수정',edited.updatedAt.toISOString()),/수정할 수/);
 assert.equal(await db.communityPost.count({where:policy.publicCommunityWhere({scope:'commented',userId:reader.id,q:post.title})}),0);
 await db.communityPost.update({where:{id:post.id},data:{status:'PUBLISHED'}});
 session={user:{id:admin.id}};await action.updateCommunityComment(comment.id,'관리자 검증 댓글 수정',edited.updatedAt.toISOString());
 edited=await db.communityComment.findUnique({where:{id:comment.id}});assert.equal(edited.content,'관리자 검증 댓글 수정');
 await db.user.update({where:{id:admin.id},data:{role:'USER'}});session={user:{id:admin.id,role:'SUPER_ADMIN'}};
 await assert.rejects(()=>action.updateCommunityComment(comment.id,'권한 철회 후 수정',edited.updatedAt.toISOString()),/권한/);await db.user.update({where:{id:admin.id},data:{role:'SUPER_ADMIN'}});
 await db.communityComment.update({where:{id:comment.id},data:{status:'DELETED'}});session={user:{id:reader.id}};
 await assert.rejects(()=>action.updateCommunityComment(comment.id,'삭제 댓글 수정',edited.updatedAt.toISOString()),/수정할 수/);
 assert.equal(await db.communityPost.count({where:policy.publicCommunityWhere({scope:'commented',userId:reader.id,q:post.title})}),0);
 await db.communityComment.update({where:{id:comment.id},data:{status:'PUBLISHED'}});
 await db.communityReport.create({data:{postId:post.id,authorId:reader.id,reason:'가상 QA 신고 이유'}});
 assert.equal(await db.communityPost.count({where:{AND:[policy.moderationWhere('reported'),{id:post.id}]}}),1);
 assert.equal(await db.communityPost.count({where:{AND:[policy.moderationWhere('hidden'),{id:post.id}]}}),0);
 const hidden=await db.communityPost.create({data:{category:'FREE',title:'비공개 QA 글',content:'공개 목록에는 나타나지 않아야 하는 QA 글입니다.',authorId:author.id,status:'HIDDEN'}});
 assert.equal(await db.communityPost.count({where:{AND:[policy.moderationWhere('hidden'),{id:hidden.id}]}}),1);
 await db.communityPost.update({where:{id:hidden.id},data:{status:'DELETED'}});assert.equal(await db.communityPost.count({where:{AND:[policy.moderationWhere(),{id:hidden.id}]}}),0);
 fs.writeFileSync(path.join(root,'scratch/portal-test-environment.json'),JSON.stringify({...previous,directory:dir,databaseUrl:url,communityHubPostId:post.id},null,2));
 console.log('Community hub: real DB filter/ownership/forged role/revoked role/stale edit/hidden/deleted/report checks PASS.');
 }finally{await db.$disconnect();}
});
