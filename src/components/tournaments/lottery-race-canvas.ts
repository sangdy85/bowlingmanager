import { raceBattleGroup, raceFinishView } from '@/lib/lottery-race-view';
import { layoutRaceNames, raceNameStyle, paintRaceNames } from '@/lib/lottery-race-labels';
import type { LotteryParticipant } from '@/lib/lottery-ui';
import { participantName } from '@/lib/lottery-ui';
import { createRacePickups, raceEffectIcons, RaceEffect, RACE_ITEMS, raceRecentEvents, type LotteryRacePlan } from '@/lib/lottery-race';
import { RACE_VISUAL_COURSE_LENGTH, raceCoursePoint } from '@/lib/lottery-race-course';
export const RACE_COLORS=['#10b6a3','#f26679','#8c75f3','#ffb83d','#409fe7','#e574bb','#7bab42','#ff8549'];
type Position={index:number;progress:number;lane?:number;effects?:number;phase?:number;finishMs?:number};
const battleViews=new WeakMap<CanvasRenderingContext2D,{x:number;y:number;scale:number;time:number}>();
/** An original open-roof bowling arena with wood lanes and scoring monitors. */
export function paintLotteryRace(ctx:CanvasRenderingContext2D,width:number,height:number,participants:LotteryParticipant[],positions:Position[],elapsed:number,followed:number|null,reduceMotion:boolean,plan?:LotteryRacePlan|null,overview=false,playbackMs?:number,expanded=false,battle=false){
    const leader=positions[0],target=followed===null?leader:positions.find(p=>p.index===followed)||leader;
    const group=positions[Math.min(positions.length-1,Math.floor(positions.length*.25))];
    const finishView=raceFinishView(plan,elapsed,playbackMs,reduceMotion);
    const verticalScale=overview?.78:Math.sin(Math.asin(.78)-(finishView.lowerDegrees+(expanded?10:0))*Math.PI/180);
    const focus=raceCoursePoint(finishView.locked&&followed===null&&!overview?1:followed===null?(target?.progress??0)*.55+(group?.progress??0)*.45:target?.progress??0);
    let scale=Math.min(width/1050,height/850)*(overview? .92 : (width<500?1.8:1.45)*1.15*finishView.zoom*(expanded?1.1*1.05:1));
    let camera=overview?{x:490,y:395}:{x:focus.x,y:focus.y*verticalScale-focus.height*.9};
    if(battle&&!overview){
        const group=raceBattleGroup(positions).map(p=>{const c=raceCoursePoint(p.progress);return{x:c.x-c.dy*(p.lane??0)*30,y:(c.y+c.dx*(p.lane??0)*30)*verticalScale-c.height*.9};});
        if(group.length){
            const xs=group.map(p=>p.x),ys=group.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
            scale=Math.min(height/(80/1.2/1.1),width*.92/(maxX-minX+48),height*.75/(maxY-minY+48));camera={x:(minX+maxX)/2,y:(minY+maxY)/2};
        }
        const now=performance.now(),previous=battleViews.get(ctx),blend=reduceMotion||!previous?1:1-Math.exp(-Math.min(100,now-previous.time)/300);
        if(previous){camera={x:previous.x+(camera.x-previous.x)*blend,y:previous.y+(camera.y-previous.y)*blend};scale=previous.scale+(scale-previous.scale)*blend;}
        battleViews.set(ctx,{...camera,scale,time:now});
    }else battleViews.delete(ctx);
    const point=(x:number,y:number,elevation=0)=>({x:width/2+(x-camera.x)*scale,y:height*(overview ? .50 : .57)+(y*verticalScale-elevation*.9-camera.y)*scale});
    const trackPoint=(progress:number,lane=0)=>{const p=raceCoursePoint(progress);return point(p.x-p.dy*lane*30,p.y+p.dx*lane*30,p.height);};
    const polygon=(points:{x:number;y:number}[],fill:string)=>{ctx.fillStyle=fill;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();};
    const rounded=(x:number,y:number,w:number,h:number,r:number,fill:string)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
    ctx.fillStyle='#101b2e';ctx.fillRect(0,0,width,height);
    for(let x=-800;x<1800;x+=100)for(let y=-600;y<1800;y+=100)polygon([point(x,y),point(x+98,y),point(x+98,y+98),point(x,y+98)],(x+y)%200?'#17263c':'#1c2c43');
    for(const x of [-190,-80,1110,1220]){
        polygon([point(x-41,60),point(x+41,60),point(x+41,980),point(x-41,980)],'#32465f');
        polygon([point(x-34,70),point(x+34,70),point(x+34,970),point(x-34,970)],'#cda56a');
        for(let lane=-3;lane<=3;lane++){const a=point(x+lane*8,70),b=point(x+lane*8,970);ctx.strokeStyle='#a67b49';ctx.lineWidth=Math.max(.4,scale*.45);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
        for(let row=0;row<4;row++)for(let pin=0;pin<=row;pin++){const p=point(x+(pin-row/2)*10,120+row*9);ctx.fillStyle='#fff4df';ctx.beginPath();ctx.ellipse(p.x,p.y-4*scale,2.3*scale,6*scale,0,0,Math.PI*2);ctx.fill();}
    }
    for(const [progress,side] of [[.08,-4],[.34,4],[.61,-4],[.88,4]]){
        const p=trackPoint(progress,side);ctx.fillStyle='#344966';ctx.fillRect(p.x-2*scale,p.y-45*scale,4*scale,45*scale);
        rounded(p.x-32*scale,p.y-62*scale,64*scale,28*scale,3*scale,'#0b1628');rounded(p.x-28*scale,p.y-58*scale,56*scale,20*scale,2*scale,'#204d6e');
        ctx.fillStyle='#6ce3dc';for(let i=0;i<8;i++)ctx.fillRect(p.x+(i-3.5)*6*scale,p.y-53*scale,4*scale,3*scale);
        const seat=trackPoint(progress+.015,side+Math.sign(side)*1.7);rounded(seat.x-30*scale,seat.y-12*scale,60*scale,18*scale,3*scale,'#38668c');
        const ret=trackPoint(progress-.015,side);rounded(ret.x-9*scale,ret.y-15*scale,18*scale,25*scale,3*scale,'#263951');ctx.fillStyle='#6ce3dc';ctx.fillRect(ret.x-6*scale,ret.y-13*scale,12*scale,3*scale);
    }
    // Draw the curved road in small segments, so the raised hill edges are visible.
    for(let i=0;i<180;i++){
        const a=raceCoursePoint(i/180),b=raceCoursePoint((i+1)/180),pa=point(a.x,a.y,a.height),pb=point(b.x,b.y,b.height);
        ctx.beginPath();ctx.moveTo(pa.x+4*scale,pa.y+9*scale);ctx.lineTo(pb.x+4*scale,pb.y+9*scale);ctx.strokeStyle='#03091199';ctx.lineWidth=86*scale;ctx.stroke();
    }
    ctx.beginPath();
    for(let i=0;i<=180;i++){const p=trackPoint(i/180);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}
    ctx.strokeStyle='#32465f';ctx.lineWidth=104*scale;ctx.stroke();ctx.strokeStyle='#091421';ctx.lineWidth=94*scale;ctx.stroke();ctx.strokeStyle='#70e1dd';ctx.lineWidth=82*scale;ctx.stroke();
    // One continuous surface avoids overlapping round-capped segment rings.
    ctx.strokeStyle='#d9b176';ctx.lineWidth=76*scale;ctx.stroke();
    ctx.save();ctx.lineCap='butt';
    for(const [from,to] of [[.14,.28],[.50,.64]]){
        ctx.beginPath();for(let i=0;i<=36;i++){const p=trackPoint(from+(to-from)*i/36);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}
        ctx.strokeStyle='#c99e63';ctx.lineWidth=76*scale;ctx.stroke();
    }
    ctx.restore();
    for(const lane of [-.9,-.6,-.3,0,.3,.6,.9]){
        ctx.beginPath();for(let i=0;i<=180;i++){const p=trackPoint(i/180,lane);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.lineWidth=Math.max(.4,scale*.45);ctx.strokeStyle='#a67b49';ctx.stroke();
    }
    // Draw the same single-use pickups that the simulation consumes.
    for(const item of plan?.pickups ?? createRacePickups(20261020)){
        if(item.collectedAt!==null&&item.collectedAt<=elapsed)continue;
        const p=trackPoint(item.progress,item.lane),s=Math.max(6,9*scale),bob=reduceMotion?0:Math.sin(elapsed/350+item.id)*2;
        if(item.kind==='bowlingPin'){ctx.fillStyle='#fff4df';ctx.beginPath();ctx.ellipse(p.x,p.y-s*.5,s*.55,s*.8,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y-s*1.7,s*.35,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e85858';ctx.fillRect(p.x-s*.25,p.y-s*1.3,s*.5,s*.22);continue;}
        ctx.fillStyle='#fff9db99';ctx.beginPath();ctx.arc(p.x,p.y-s+bob,s,0,Math.PI*2);ctx.fill();ctx.font=`${s*1.7}px sans-serif`;ctx.textAlign='center';ctx.fillText(RACE_ITEMS.find(kind=>kind.key===item.kind)!.icon,p.x,p.y-s*.4+bob);
    }
    for(const [progress,label] of [[0,'START'],[1,'FINISH']] as const){
        const a=trackPoint(progress,-1.35),b=trackPoint(progress,1.35);
        ctx.strokeStyle='#193c4d';ctx.lineWidth=5*scale;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x,a.y-35*scale);ctx.lineTo(b.x,b.y-35*scale);ctx.lineTo(b.x,b.y);ctx.stroke();
        const mid=trackPoint(progress);rounded(mid.x-32*scale,mid.y-47*scale,64*scale,17*scale,3*scale,'#183c4e');ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(8,11*scale)}px sans-serif`;ctx.textAlign='center';ctx.fillText(label,mid.x,mid.y-35*scale);
        for(let i=0;i<12;i++){
            const from=-1.3+i*2.6/12,to=-1.3+(i+1)*2.6/12,start=trackPoint(progress,from),end=trackPoint(progress,to);
            ctx.strokeStyle=i%2?'#fff':'#173344';ctx.lineWidth=7*scale;ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
        }
        ctx.lineCap='round';
    }
    const ranks=new Map(positions.map((p,i)=>[p.index,i]));
    const sprites=positions.map(r=>{
        const lane=r.lane??(r.index%8-3.5)/4,p=raceCoursePoint(r.progress);
        const grid=(1-Math.min(1,r.progress/.12))*(15+Math.sin(r.phase??r.index*1.31)*15);
        return {...r,lane,screen:point(p.x-p.dx*grid-p.dy*lane*30,p.y-p.dy*grid+p.dx*lane*30,p.height)};
    }).filter(p=>p.screen.x> -70&&p.screen.x<width+70&&p.screen.y> -80&&p.screen.y<height+70);
    const priority=sprites.filter(p=>p.index===followed||(ranks.get(p.index)??Infinity)<6),ids=new Set(priority.map(p=>p.index));
    const visible=[...sprites.filter(p=>!ids.has(p.index)).slice(-210),...priority].sort((a,b)=>a.screen.y-b.screen.y);
    for(const runner of visible){
        const {index,screen:p}=runner,mask=runner.effects??0,s=Math.min(13,Math.max(4.5,10*scale)),color=RACE_COLORS[index%RACE_COLORS.length];
        const roll=reduceMotion?0:runner.progress*RACE_VISUAL_COURSE_LENGTH/7.2;
        ctx.fillStyle='#143e3b28';ctx.beginPath();ctx.ellipse(p.x,p.y+2,s*1.1,s*.4,0,0,Math.PI*2);ctx.fill();
        if(mask&(RaceEffect.STRIKE|RaceEffect.SPIN|RaceEffect.PERFECT)){
            ctx.strokeStyle=mask&RaceEffect.PERFECT?'#ddd4ff':mask&RaceEffect.SPIN?'#ff725c':'#75f0d3';ctx.lineWidth=s*.3;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(p.x+i*s*.4,p.y);ctx.lineTo(p.x+i*s*.5,p.y+s*2);ctx.stroke();}
        }
        ctx.save();ctx.translate(p.x,p.y-s);ctx.rotate(roll);
        const shine=ctx.createRadialGradient(-s*.35,-s*.4,s*.08,0,0,s);shine.addColorStop(0,'#eafcff');shine.addColorStop(.28,color);shine.addColorStop(1,'#193254');
        ctx.fillStyle=shine;ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ffffff55';ctx.lineWidth=s*.22;ctx.beginPath();ctx.ellipse(0,0,s*.72,s*.33,.7,0,Math.PI*2);ctx.stroke();
        for(const [x,y] of [[-.28,-.32],[.28,-.32],[0,.25]]){ctx.fillStyle='#111c30';ctx.beginPath();ctx.arc(x*s,y*s,s*.13,0,Math.PI*2);ctx.fill();}ctx.restore();
        if(mask&(RaceEffect.SPARE|RaceEffect.PROTECTED)){ctx.strokeStyle=mask&RaceEffect.PROTECTED?'#e0c6ff':'#9de7ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y-s,s*1.35,0,Math.PI*2);ctx.stroke();}
        const icons=raceEffectIcons(mask).slice(0,2).join('');
        if(icons){ctx.font=`${Math.max(11,13*scale)}px sans-serif`;ctx.textAlign='center';ctx.fillText(icons,p.x,p.y-s*2.6);}
    }
    ctx.font=raceNameStyle(width,expanded,battle&&!overview).font;
    const names=layoutRaceNames(visible.filter(r=>r.screen.x>0&&r.screen.x<width&&r.screen.y>0&&r.screen.y<height).map(r=>({index:r.index,rank:ranks.get(r.index),text:participantName(participants[r.index]),x:r.screen.x,y:r.screen.y-18,priority:r.index===followed||(ranks.get(r.index)??0)<3,gold:r.index===followed||ranks.get(r.index)===0})),width,height,text=>ctx.measureText(text).width,expanded,battle&&!overview);
    if(!expanded)paintRaceNames(ctx,names,width,false,battle&&!overview);
    if(plan){
        const recent=raceRecentEvents(plan,elapsed,3500).filter(e=>followed===null||e.actor===followed||e.targets.includes(followed)||e.phase==='use').slice(-180);
        for(const event of recent){const source=trackPoint(event.progress,event.lane),age=elapsed-event.time,item=RACE_ITEMS.find(i=>i.key===event.kind)!;
            if(event.kind==='dry'&&event.phase==='trap'&&age<3000){const a=trackPoint(Math.max(0,event.progress-.029),event.lane-.9),b=trackPoint(Math.min(1,event.progress+.029),event.lane+.9);ctx.fillStyle='#a8743660';ctx.fillRect(Math.min(a.x,b.x)-8,Math.min(a.y,b.y)-6,Math.abs(a.x-b.x)+16,Math.abs(a.y-b.y)+12);}
            if(event.phase==='use'&&event.kind==='turkey'&&age<150){ctx.font='18px sans-serif';ctx.fillText('❌❌❌',source.x,source.y-28);}
            if(event.phase==='use'&&['pinShot','kingPin','split','turkey'].includes(event.kind)&&age<600&&event.targets.length){for(const target of event.targets){const victim=positions.find(p=>p.index===target);if(victim){const end=trackPoint(victim.progress,victim.lane??0),t=age/600;ctx.strokeStyle=event.kind==='kingPin'?'#ffbc29':'#ff6469';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(source.x,source.y-12);ctx.lineTo(end.x,end.y-12);ctx.stroke();ctx.setLineDash([]);ctx.font='19px sans-serif';ctx.fillText(item.icon,source.x+(end.x-source.x)*t,source.y+(end.y-source.y)*t-15);}}}
            else if(age<1100&&(event.phase==='hit'||event.phase==='block'||event.kind==='dry'&&event.phase==='trap')){ctx.strokeStyle=event.kind==='dry'?'#52caff':'#ffe382';ctx.lineWidth=3;ctx.globalAlpha=Math.max(0,1-age/1100);ctx.beginPath();ctx.arc(source.x,source.y-5,(12+age/35)*scale,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
            else if(age<1000){ctx.font='18px sans-serif';ctx.textAlign='center';ctx.fillText(item.icon,source.x,source.y-36-age/100);}
        }

    }
    // Overview inset preserves orientation even when following a runner on a bend.
    const miniW=width<500?62:88,miniH=miniW*.85,mx=width-miniW-12,my=height-miniH-46;
    rounded(mx-6,my-6,miniW+12,miniH+12,8,'#173b4bd9');ctx.beginPath();for(let i=0;i<=80;i++){const p=raceCoursePoint(i/80),x=mx+p.x/1000*miniW,y=my+p.y/1000*miniH;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle='#f5d395';ctx.lineWidth=3;ctx.stroke();if(target){const p=raceCoursePoint(target.progress);ctx.fillStyle='#8affd7';ctx.beginPath();ctx.arc(mx+p.x/1000*miniW,my+p.y/1000*miniH,3,0,Math.PI*2);ctx.fill();}
    if(expanded)paintRaceNames(ctx,names,width,true,battle&&!overview);
}
