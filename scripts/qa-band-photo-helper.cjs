// Local DOM fixture only. Never contacts BAND or a database containing user data.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const helper = path.join(root, 'extensions/band-photo-helper');
const transfer = fs.readFileSync(path.join(helper, 'transfer.js'), 'utf8').replace(/^export /gm, '');
const controller = fs.readFileSync(path.join(helper, 'controller.js'), 'utf8').replace(/^import .*\r?\n/gm, '').replace(/^export /gm, '');
const bridge = fs.readFileSync(path.join(helper, 'bridge.js'), 'utf8')
    .replace("const { readPreparedSource } = await import(chrome.runtime.getURL('transfer.js'))", 'const { readPreparedSource: readFromPreview } = await Promise.resolve({readPreparedSource})')
    .replace('const packet = readPreparedSource();', 'const packet = readFromPreview();');
const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>BAND 사진 전달 확장 QA</title><style>
body{font:14px Arial,sans-serif;color:#10283e;background:#f2f5fa;margin:24px}main{max-width:1000px;margin:auto}button{padding:10px 14px;margin:5px;border:1px solid #087e70;border-radius:7px;background:#fff;color:#10283e;cursor:pointer}h1{font-size:24px}section{padding:20px;margin:16px 0;background:white;border:1px solid #cbd5e1;border-radius:12px}dialog{position:static;width:auto;margin:10px 0;padding:16px;border:1px solid #94a3b8}textarea{display:block;width:95%;margin:8px 0;padding:8px}figure{display:inline-block;margin:8px;width:210px}img{width:100%;max-height:160px;object-fit:contain}.contentEditor{min-height:90px;border:1px solid #94a3b8;padding:14px;margin:10px 0}[hidden]{display:none!important}#status{background:#fff1cd;padding:14px;white-space:pre-wrap}#previews{display:flex;gap:10px;flex-wrap:wrap}#previews figure{width:160px}label{display:block;margin:8px 0}
</style><main><h1>PC BAND 사진 전달 · 격리 QA</h1><p>실제 확장 함수와 Chromium File/DataTransfer/IndexedDB를 사용합니다. 주소는 이 모형 내부에서만 시뮬레이션합니다. 실제 BAND 전송·로그인·게시·운영 DB 접근 없음.</p>
<button id="show-source">볼링매니저 모형 보기</button><button id="show-band">BAND 글쓰기 모형 보기</button>
<section id="source"><dialog open aria-labelledby="share-title"><h2 id="share-title">BAND 공식 공유하기</h2>
<label for="caption">공유할 공지 문구</label><textarea id="caption">가상 대회\n1주차 · 공식 결과표 4종</textarea><label for="below">사진 아래에 쓰기</label><textarea id="below">사진 전달 테스트 · 실제 게시 금지</textarea>
<section aria-label="BAND 첨부 사진" id="source-photos"></section><label><input id="approval" type="checkbox">선수 이름·팀·경기 기록의 공유 범위와 수정 문구를 확인했습니다.</label>
<button id="page-capture" data-band-photo-helper="capture" data-band-photo-request="qa-page">사이트 버튼으로 PC BAND에 사진 전달</button></dialog><button id="capture">1. 준비된 사진 가져오기 테스트</button></section>
<section id="band" hidden><h1><a id="band-name" href="https://www.band.us/band/123/post">가상 밴드</a></h1><div role="dialog" aria-modal="true" aria-labelledby="editorviewqa" id="composer"><h2 id="editorviewqa">글쓰기</h2>
<div class="contentEditor _richEditor" contenteditable="true" role="textbox" aria-label="BAND 글 본문"></div><input type="file" id="postPhotoInput_qa" accept="image/*" name="attachment" multiple hidden><div id="previews"></div><button id="publish">게시 모형 (실제 전송 없음)</button></div>
<button id="inspect">2. 대상 글쓰기 확인</button><button id="attach">3. 사진 첨부 테스트</button><button id="reset">빈 작성창으로 초기화</button><button id="switch-band">대상 밴드 바꾸기</button><button id="replace-composer">작성창 바꾸기</button><button id="existing-text">기존 문구 넣기</button><button id="existing-image">기존 사진 넣기</button></section>
<button id="expiry">임시 사진 만료 테스트</button><p id="status" role="status">사진 준비 후 공유 범위를 확인해주세요.</p><output id="result">사진 0개 · 파일 변경 0회 · 게시 0회</output><pre id="metadata"></pre></main><script type="module" src="/qa.js"></script></html>`;
const js = `import {getPacket,putPacket,clearPacket} from '/store.js';
let location={protocol:'https:',hostname:'www.bowlingmanager.co.kr',port:'',pathname:'/centers/qa',href:'https://www.bowlingmanager.co.kr/centers/qa'};
${transfer}
${controller}
const el=id=>document.getElementById(id),editor=()=>document.querySelector('.contentEditor');let destination=null,changed=0,published=0,pictures=[];
for(let i=0;i<4;i++){const c=document.createElement('canvas');c.width=640;c.height=320;const x=c.getContext('2d');x.fillStyle=['#e0f2fe','#dcfce7','#fef3c7','#e0e7ff'][i];x.fillRect(0,0,640,320);x.fillStyle='#10283e';x.font='bold 30px sans-serif';x.fillText('테스트 결과표 '+(i+1),30,90);x.font='24px sans-serif';x.fillText('BAND 게시하지 마세요',30,170);pictures.push({name:'결과표_'+(i+1)+'.png',dataUrl:c.toDataURL('image/png')});const f=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption'),b=document.createElement('button');img.src=pictures[i].dataUrl;img.alt='결과표 '+(i+1);b.textContent=pictures[i].name+' 저장';cap.append(b);f.append(img,cap);el('source-photos').append(f);}
const run=fn=>async()=>{try{const r=await fn();if(r)el('status').textContent=typeof r==='string'?r:JSON.stringify(r);}catch(e){el('status').textContent=e.message;}};
el('show-source').onclick=()=>{el('source').hidden=false;el('band').hidden=true;Object.assign(location,{hostname:'www.bowlingmanager.co.kr',pathname:'/centers/qa',href:'https://www.bowlingmanager.co.kr/centers/qa'});};
el('show-band').onclick=()=>{el('source').hidden=true;el('band').hidden=false;Object.assign(location,{hostname:'www.band.us',pathname:'/band/123/post',href:'https://www.band.us/band/123/post'});};
el('capture').onclick=run(async()=>{const packet=validatePacket(readPreparedSource());await putPacket(packet);el('metadata').textContent=JSON.stringify({id:packet.id,names:packet.images.map(x=>x.name),text:packet.text});return '사진 '+packet.images.length+'개와 문구를 임시 저장했습니다.';});
el('inspect').onclick=run(async()=>{destination=bandComposerAction();return destination;});
el('attach').onclick=run(async()=>{const packet=await getPacket();if(!packet)throw Error('준비된 사진 없음');if(!destination)throw Error('대상 확인 필요');const result=bandComposerAction({...packet,expectedBandId:destination.bandId,expectedComposerId:destination.composerId});await clearPacket();return result;});
const update=()=>{el('result').textContent='사진 '+document.getElementById('postPhotoInput_qa').files.length+'개 · 파일 변경 '+changed+'회 · 게시 '+published+'회';};
el('postPhotoInput_qa').onchange=event=>{changed++;el('previews').replaceChildren();for(const file of event.target.files){const f=document.createElement('figure'),img=document.createElement('img'),name=document.createElement('figcaption');img.src=URL.createObjectURL(file);img.alt=file.name;name.textContent=file.name;f.append(img,name);el('previews').append(f);}update();};
el('publish').onclick=()=>{published++;update();};
el('reset').onclick=()=>{const input=document.querySelector('input[type=file]');input.id='postPhotoInput_qa';input.value='';el('composer').dataset.bmBandPhotoTransfer='';editor().textContent='';el('previews').replaceChildren();el('composer').setAttribute('aria-labelledby','editorviewqa');document.querySelector('#composer h2').id='editorviewqa';location.pathname='/band/123/post';changed=0;published=0;destination=null;update();el('status').textContent='작성창 초기화';};
el('switch-band').onclick=()=>{location.pathname='/band/456/post';el('status').textContent='대상 밴드 변경';};
el('replace-composer').onclick=()=>{el('composer').setAttribute('aria-labelledby','editorviewnew');document.querySelector('#composer h2').id='editorviewnew';el('status').textContent='작성창 변경';};
el('existing-text').onclick=()=>{editor().textContent='관리자가 이미 작성한 문구';};
el('existing-image').onclick=()=>{const img=document.createElement('img');img.src=pictures[0].dataUrl;img.alt='기존 사진';el('previews').append(img);};
el('expiry').onclick=run(async()=>{const packet=validatePacket({version:1,sourceUrl:'https://www.bowlingmanager.co.kr/qa',text:'만료',images:pictures},Date.now()-EXPIRY_MS-1);await putPacket(packet);return (await getPacket())===null?'만료된 사진 자동 삭제 확인':'실패';});
const fromPage=createController({activeTab:async()=>{throw Error('Page capture must not request activeTab');},execute:async()=>{throw Error('Page capture must not inject');},getPacket,putPacket,clearPacket,createAlarm:async()=>{},clearAlarm:async()=>{},openBand:async()=>{el('show-band').click();}});
const chrome={runtime:{getManifest:()=>({version:'0.2.0'}),sendMessage:async message=>{try{return {ok:true,result:await fromPage(message)};}catch(error){return {ok:false,message:error.message};}}}};
window.addEventListener('bm-band-photo-helper-result',async event=>{const detail=event.detail;el('status').textContent=detail.ok?'사이트 버튼 → 사진 '+detail.count+'개 전달 · BAND 글쓰기 열림 (모형)':detail.message;el('metadata').textContent=JSON.stringify({connected:document.documentElement.dataset.bmBandPhotoHelper,count:(await getPacket())?.images.length||0});});
${bridge}
`;
const files = new Map([
    ['/', [page, 'text/html; charset=utf-8']], ['/qa.js', [js, 'text/javascript; charset=utf-8']],
    ['/store.js', [fs.readFileSync(path.join(helper, 'store.js')), 'text/javascript; charset=utf-8']],
]);
http.createServer((request, response) => {
    const file = files.get(new URL(request.url, 'http://127.0.0.1').pathname);
    response.setHeader('Cache-Control', 'no-store');
    if (!file) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', file[1]); response.end(file[0]);
}).listen(3167, '127.0.0.1', () => console.log('Local fixture only: http://127.0.0.1:3167/'));
