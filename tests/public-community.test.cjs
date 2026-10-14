'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createRequire}=require('node:module');
const ts=require('typescript');
const {PrismaClient}=require('@prisma/client');

function load(relative,mocks,cache=new Map()) {
    const filename=path.resolve(__dirname,'..',relative);if(cache.has(filename))return cache.get(filename).exports;
    const module={exports:{}};cache.set(filename,module);
    const req=createRequire(filename);
    const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    new Function('require','module','exports',output)(id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith('@/')?load('src/'+id.slice(2)+'.ts',mocks,cache):req(id),module,module.exports);
    return module.exports;
}

async function run() {
    const root=path.resolve(__dirname,'..');
    fs.mkdirSync(path.join(root,'scratch'),{recursive:true});
    const dir=fs.mkdtempSync(path.join(root,'scratch','portal-test-'));
    const url='file:'+path.join(dir,'test.db').replace(/\\/g,'/');
    const env={...process.env,DATABASE_URL:'file:../scratch/'+path.basename(dir)+'/test.db'};
    fs.writeFileSync(path.join(dir,'test.db'),'');
    execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env,stdio:'pipe'});
    const db=new PrismaClient({datasources:{db:{url}}});
    let session=null;
    const action=load('src/app/actions/community.ts',{'@/auth':{auth:async()=>session},'@/lib/prisma':{__esModule:true,default:db},'next/cache':{revalidatePath(){}}});
    try {
        const password=await require('bcryptjs').hash('Portal-QA-2026!',10);
        const a=await db.user.create({data:{email:'portal-author@example.test',name:'로컬 테스트 볼러',password,emailVerified:new Date()}});
        const b=await db.user.create({data:{email:'portal-reader@example.test',name:'로컬 테스트 독자',password,emailVerified:new Date()}});
        const admin=await db.user.create({data:{email:'portal-admin@example.test',name:'로컬 테스트 관리자',role:'SUPER_ADMIN',password,emailVerified:new Date()}});
        const input={category:'QUESTION',title:'로컬 테스트 · 볼링공 선택 질문',content:'이 게시글은 별도 로컬 테스트 DB에만 있는 검증용 예시입니다.'};
        await assert.rejects(()=>action.saveCommunityPost(null,input),/로그인/);
        session={user:{id:a.id,role:'USER'}};
        await assert.rejects(()=>action.saveCommunityPost(null,{...input,category:'PRIVATE_TEAM'}),/게시판/);
        await assert.rejects(()=>action.saveCommunityPost(null,{...input,title:'x'}),/제목/);
        const created=await action.saveCommunityPost(null,input);
        assert.equal(await db.post.count(),0,'public posts must not enter private team board');
        assert.equal(await db.communityPost.count(),1);
        await assert.rejects(()=>action.saveCommunityPost(null,input),/1분/);
        session={user:{id:b.id,role:'SUPER_ADMIN'}};
        await assert.rejects(()=>action.saveCommunityPost(created.id,input),/권한/);
        await assert.rejects(()=>action.deleteCommunityPost(created.id),/권한/);
        await assert.rejects(()=>action.moderateCommunityPost(created.id,true),/관리자/,'role is read from DB');
        await action.addCommunityComment(created.id,'로컬 검증용 댓글입니다.');
        const comment=await db.communityComment.findFirst();
        session={user:{id:a.id,role:'USER'}};
        await assert.rejects(()=>action.deleteCommunityComment(comment.id),/권한/);
        await action.saveCommunityPost(created.id,{...input,title:'수정한 로컬 테스트 질문'});
        assert.equal((await db.communityPost.findUnique({where:{id:created.id}})).title,'수정한 로컬 테스트 질문');
        session={user:{id:b.id,role:'USER'}};
        await action.reportCommunityPost(created.id,'검증용 신고 내용입니다.');
        await action.reportCommunityPost(created.id,'두 번째 검증용 신고 내용입니다.');
        assert.equal(await db.communityReport.count(),1,'duplicate reporter is deduplicated');
        session={user:{id:admin.id,role:'SUPER_ADMIN'}};
        await action.moderateCommunityPost(created.id,true);
        assert.equal(await db.communityPost.count({where:{status:'PUBLISHED'}}),0);
        session={user:{id:b.id,role:'USER'}};
        await assert.rejects(()=>action.addCommunityComment(created.id,'숨김 글 댓글'),/작성할 수 없는/);
        session={user:{id:admin.id,role:'SUPER_ADMIN'}};
        await action.deleteCommunityComment(comment.id);
        assert.equal((await db.communityComment.findUnique({where:{id:comment.id}})).status,'DELETED');
        await action.moderateCommunityPost(created.id,false);
        await action.deleteCommunityPost(created.id);
        assert.equal(await db.communityPost.count({where:{status:'PUBLISHED'}}),0);
        await assert.rejects(()=>action.moderateCommunityPost(created.id,false),/찾을 수/);
        // Keep one explicitly labeled local fixture for browser verification.
        await db.communityPost.create({data:{...input,authorId:a.id}});
        const center=await db.bowlingCenter.create({data:{name:'로컬 테스트 볼링센터',code:'PORTALQA',address:'검증용 가상 센터 · 운영 데이터 아님',ownerId:admin.id}});
        await db.tournament.create({data:{name:'로컬 테스트 챔프전',type:'CHAMP',status:'ONGOING',centerId:center.id,startDate:new Date('2026-10-01T00:00:00Z'),endDate:new Date('2026-11-01T00:00:00Z')}});
        await db.tournament.create({data:{name:'로컬 테스트 지난 리그',type:'LEAGUE',status:'FINISHED',centerId:center.id,startDate:new Date('2025-01-01T00:00:00Z'),endDate:new Date('2025-03-01T00:00:00Z')}});
        const info={directory:dir,databaseUrl:url,fixturePostId:(await db.communityPost.findFirst({where:{status:'PUBLISHED'}})).id};
        fs.writeFileSync(path.join(root,'scratch','portal-test-environment.json'),JSON.stringify(info,null,2));
        console.log('public community DB regression: PASS (isolated migration, auth, CRUD, rate limit, comment, report, moderation)');
        console.log('Local browser test DB prepared: scratch/portal-test-environment.json');
    } finally {await db.$disconnect();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
