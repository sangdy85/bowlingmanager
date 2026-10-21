import { raceFinishView } from '@/lib/lottery-race-view';
import { layoutRaceNames, raceNameStyle, paintRaceNames } from '@/lib/lottery-race-labels';
import { participantName, type LotteryParticipant } from '@/lib/lottery-ui';
import { createRacePickups, RACE_ITEMS, RaceEffect, raceEffectIcons, raceRecentEvents, type LotteryRacePlan, type RacePickup } from '@/lib/lottery-race';
import { RACE_VISUAL_COURSE_LENGTH, raceCoursePoint } from '@/lib/lottery-race-course';
import { RaceMesh, rgb, raceBallMatrix, raceMatrixMultiply, racePerspective, raceProject, raceViewMatrix, type Vec3 } from '@/lib/lottery-race-geometry';
import { RACE_COLORS } from './lottery-race-canvas';

type Position = { index: number; progress: number; lane?: number; effects?: number; phase?: number; finishMs?: number };
const world = (progress: number, lane = 0, lift = 0): Vec3 => {
    const p = raceCoursePoint(progress);
    return [p.x - p.dy * lane * 30, p.height + lift, p.y + p.dx * lane * 30];
};
const vertexShader = 'attribute vec3 a_position;attribute vec3 a_color;uniform mat4 u_matrix;uniform mat4 u_model;uniform float u_ball;varying vec3 v_color;void main(){vec4 world=u_model*vec4(a_position,1.0);gl_Position=u_matrix*world;v_color=a_color;if(u_ball>0.5&&max(a_color.r,max(a_color.g,a_color.b))>0.2){vec3 n=normalize(mat3(u_model)*a_position);float light=0.7+0.3*max(0.0,dot(n,vec3(-0.35,0.8,0.45)));float shine=pow(max(0.0,dot(n,vec3(-0.35,0.7,0.62))),18.0)*0.4;v_color=min(vec3(1.0),a_color*light+shine);}}';
const fragmentShader = 'precision mediump float;varying vec3 v_color;void main(){gl_FragColor=vec4(v_color,1.0);}';

const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const cameraTurn=(progress:number)=>{const t=Math.max(0,Math.min(1,(progress-.5)/.18));return t*t*(3-2*t);};
/** After halfway, orbit to the finish side and look back along the approaching pack. */
export function lotteryRaceCamera(progress:number,aspect:number,overview:boolean,phaseProgress=progress,lowerDegrees=0){
    if(overview)return{eye:[490,Math.max(1450,1100/Math.max(.4,aspect)),780] as Vec3,look:[490,0,530] as Vec3};
    const turn=cameraTurn(phaseProgress),focus=world(progress),ahead=world(Math.min(1,progress+.06)),behind=world(Math.max(0,progress-.14));
    const look:Vec3=[focus[0]+(ahead[0]-focus[0])*.25*(1-turn)+(behind[0]-focus[0])*.4*turn,focus[1]+6,focus[2]+(ahead[2]-focus[2])*.25*(1-turn)+(behind[2]-focus[2])*.4*turn];
    const angle=Math.atan2(360,160)+Math.PI*turn,radius=Math.hypot(160,360)*1.18;
    // Portrait screens need extra width in the finish view for both the gate and the chase.
    const framing=Math.max(1,Math.min(2.8,(1-turn)*Math.sqrt(1/Math.max(.4,aspect))+turn*1.15/Math.max(.4,aspect)));
    const height=(680+160*turn)*framing;
    const vertical=focus[1]+height-look[1],distance=Math.hypot(radius,vertical);
    const pitch=Math.atan2(vertical,radius)-lowerDegrees*Math.PI/180;
    const orbitRadius=lowerDegrees?distance*Math.cos(pitch):radius,orbitHeight=lowerDegrees?distance*Math.sin(pitch):vertical;
    return{eye:[look[0]+Math.cos(angle)*orbitRadius,look[1]+orbitHeight,look[2]+Math.sin(angle)*orbitRadius] as Vec3,look};
}
/** Original open-roof bowling arena, built locally with WebGL; no copied models, textures or remote assets. */
export class LotteryRaceScene {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private staticBuffer: WebGLBuffer;
    private dynamicBuffer: WebGLBuffer;
    private ballBuffer: WebGLBuffer;
    private ballVertices=0;
    private dynamicStorage=new Float32Array(0);
    private ballTransform=new Float32Array(16);
    private model: WebGLUniformLocation;
    private ballLighting: WebGLUniformLocation;
    private cameraProgress:number|null=null;
    private cameraPhaseProgress=0;
    private previousOverview:boolean|null=null;
    private previousExpanded:boolean|null=null;
    private previousFollowed:number|null=null;
    private count: number;
    private position: number;
    private color: number;
    private matrix: WebGLUniformLocation;
    private eye: Vec3 | null = null;
    private look: Vec3 | null = null;
    private lastPaint = 0;
    private previewPickups = createRacePickups(20261020);

    constructor(private canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'default' });
        if (!gl) throw new Error('WebGL unavailable');
        this.gl = gl;
        const shaders: WebGLShader[] = [];
        const compile = (type: number, source: string) => {
            const shader = gl.createShader(type);
            if (!shader) throw new Error('Shader unavailable');
            gl.shaderSource(shader, source); gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Shader compile failed'); }
            shaders.push(shader); return shader;
        };
        const program = gl.createProgram();
        if (!program) throw new Error('Program unavailable');
        try {
            gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader)); gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Program link failed');
        } catch (error) { gl.deleteProgram(program); throw error; } finally { shaders.forEach(shader => gl.deleteShader(shader)); }
        this.program = program;
        this.position = gl.getAttribLocation(program, 'a_position'); this.color = gl.getAttribLocation(program, 'a_color');
        const matrix=gl.getUniformLocation(program,'u_matrix'),model=gl.getUniformLocation(program,'u_model'),ballLighting=gl.getUniformLocation(program,'u_ball'),staticBuffer=gl.createBuffer(),dynamicBuffer=gl.createBuffer(),ballBuffer=gl.createBuffer();
        if(!matrix||!model||!ballLighting||!staticBuffer||!dynamicBuffer||!ballBuffer){gl.deleteProgram(program);for(const buffer of [staticBuffer,dynamicBuffer,ballBuffer])if(buffer)gl.deleteBuffer(buffer);throw new Error('Scene buffers unavailable');}
        this.matrix=matrix;this.model=model;this.ballLighting=ballLighting;this.staticBuffer=staticBuffer;this.dynamicBuffer=dynamicBuffer;this.ballBuffer=ballBuffer;
        const mesh = this.arena(); const values = mesh.array(); this.count = values.length / 6;
        gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer); gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
        // Build the eight ball materials once. Rolling and lighting run on the GPU.
        const balls=new RaceMesh();for(let style=0;style<RACE_COLORS.length;style++)balls.bowlingBall(0,0,0,1,rgb(RACE_COLORS[style]),0,0,style,true);
        const ballValues=balls.array();this.ballVertices=ballValues.length/6/RACE_COLORS.length;
        gl.bindBuffer(gl.ARRAY_BUFFER,ballBuffer);gl.bufferData(gl.ARRAY_BUFFER,ballValues,gl.STATIC_DRAW);
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    }

    private arena() {
        const mesh = new RaceMesh();
        mesh.quad([-4000, -5, -4000], [-4000, -5, 5000], [5000, -5, 5000], [5000, -5, -4000], rgb('#101b2e'));
        // Navy carpet tiles and inset aisle lighting replace the outdoor scenery.
        for(let x=-800;x<1800;x+=100)for(let z=-600;z<1800;z+=100){
            mesh.quad([x,-4.8,z],[x,-4.8,z+98],[x+98,-4.8,z+98],[x+98,-4.8,z],rgb((x+z)%200?'#17263c':'#1c2c43'));
        }
        const ribbon = (halfWidth: number, lift: number, color: string) => {
            for (let i = 0; i < 240; i++) mesh.quad(world(i / 240, -halfWidth / 30, lift), world((i + 1) / 240, -halfWidth / 30, lift), world((i + 1) / 240, halfWidth / 30, lift), world(i / 240, halfWidth / 30, lift), rgb(color));
        };
        ribbon(54,-.7,'#32465f');ribbon(49,-.3,'#091421');ribbon(43,.2,'#70e1dd');ribbon(41,.5,'#d9b176');
        // The pack waits on the same wood surface behind the start gate.
        const start=raceCoursePoint(0);
        for(const [halfWidth,lift,color] of [[44,0,'#f8e7bf'],[41,.5,'#d9b176']] as [number,number,string][]){
            const left=world(0,-halfWidth/30,lift),right=world(0,halfWidth/30,lift);
            mesh.quad([left[0]-start.dx*100,left[1],left[2]-start.dy*100],left,right,[right[0]-start.dx*100,right[1],right[2]-start.dy*100],rgb(color));
        }
        // Finishers slow down into a wide gathering area, leaving the line clear
        // for the people still arriving rather than stopping in a single pile.
        const finish=raceCoursePoint(1);
        for(const [halfWidth,lift,color] of [[86,0,'#f8e7bf'],[83,.5,'#d9b176']] as [number,number,string][]){
            const left=world(1,-halfWidth/30,lift),right=world(1,halfWidth/30,lift);
            mesh.quad(left,[left[0]+finish.dx*150,left[1],left[2]+finish.dy*150],[right[0]+finish.dx*150,right[1],right[2]+finish.dy*150],right,rgb(color));
        }
        // Dark supports beneath the raised arcade lane.
        for (let i = 0; i < 240; i++) {
            const a = world(i / 240, -1.46), b = world((i + 1) / 240, -1.46), c = world(i / 240, 1.46), d = world((i + 1) / 240, 1.46);
            const outsideA=world(i/240,-2.9),outsideB=world((i+1)/240,-2.9),outsideC=world(i/240,2.9),outsideD=world((i+1)/240,2.9);
            mesh.quad([outsideA[0],-4,outsideA[2]],a,b,[outsideB[0],-4,outsideB[2]],rgb('#152b42'));
            mesh.quad(c,[outsideC[0],-4,outsideC[2]],[outsideD[0],-4,outsideD[2]],d,rgb('#14263e'));
        }
        // Long board seams and lane arrows turn the winding track into a bowling lane.
        for(let lane=-1.2;lane<=1.21;lane+=.3)for(let i=0;i<160;i++){
            const a=world(i/160,lane,.75),b=world((i+1)/160,lane,.75),n=raceCoursePoint(i/160);
            mesh.quad(a,b,[b[0]-n.dy*.23,b[1],b[2]+n.dx*.23],[a[0]-n.dy*.23,a[1],a[2]+n.dx*.23],rgb('#ae824a'));
        }
        for(const progress of [.07,.45,.83])for(const lane of [-.9,-.45,0,.45,.9]){
            const p=world(progress,lane,1),n=raceCoursePoint(progress);
            mesh.triangle([p[0]+n.dx*5,p[1],p[2]+n.dy*5],[p[0]-n.dx*3-n.dy*2.5,p[1],p[2]-n.dy*3+n.dx*2.5],[p[0]-n.dx*3+n.dy*2.5,p[1],p[2]-n.dy*3-n.dx*2.5],rgb('#456878'));
        }
        for(const progress of [0,1])for(const lane of [-2.1,2.1]){const p=world(progress,lane);mesh.bowlingPin(p[0],p[1],p[2],2.5);}
        // Practice lanes frame the arena. Low structures keep both camera directions open.
        for(const x of [-190,-80,1110,1220]){
            mesh.box(x,-1,520,82,4,920,rgb('#2e4058'));
            mesh.box(x,1.5,520,68,2,900,rgb('#cda56a'));
            for(let board=-3;board<=3;board++)mesh.box(x+board*8,2.6,520,.45,.2,900,rgb('#a67b49'));
            for(const side of [-38,38])mesh.box(x+side,2.8,520,1.3,.5,920,rgb('#5edbd8'));
            for(let row=0;row<4;row++)for(let pin=0;pin<=row;pin++)mesh.bowlingPin(x+(pin-row/2)*10,2.7,120+row*9,1.1);
            mesh.box(x,13,65,86,25,30,rgb('#152b48'));
            mesh.box(x,27,65,74,2,18,rgb('#68d8e0'));
        }
        // Screens, ball returns and upholstered seating beside the racing lane.
        for(const [progress,side] of [[.08,-4],[.34,4],[.61,-4],[.88,4]] as const){
            const p=world(progress,side),t=raceCoursePoint(progress),yaw=Math.atan2(t.dx,t.dy);
            mesh.box(p[0],p[1]+21,p[2],4,42,4,rgb('#344966'));
            mesh.box(p[0],p[1]+51,p[2],64,28,6,rgb('#0b1628'),yaw);
            mesh.box(p[0],p[1]+51,p[2],58,22,6.5,rgb('#204d6e'),yaw);
            for(let col=0;col<8;col++){const d=(col-3.5)*6.4;mesh.box(p[0]+Math.cos(yaw)*d,p[1]+53,p[2]-Math.sin(yaw)*d,4.5,2,7,rgb(col%3?'#6ce3dc':'#f9c678'),yaw);}
            const seat=world(progress+.015,side+Math.sign(side)*1.7);
            mesh.box(seat[0],seat[1]+6,seat[2],60,12,24,rgb('#234a6a'),yaw);
            mesh.box(seat[0],seat[1]+15,seat[2],60,16,6,rgb('#38668c'),yaw);
            const ret=world(progress-.015,side);
            mesh.box(ret[0],ret[1]+7,ret[2],18,14,38,rgb('#263951'),yaw);
            mesh.box(ret[0],ret[1]+15,ret[2],14,3,28,rgb('#6ce3dc'),yaw);
        }
        // Perimeter wall panels and architectural light strips, with no roof to obstruct play.
        for(const z of [-100,1200]){
            mesh.box(510,20,z,1540,45,12,rgb('#26364e'));
            mesh.box(510,44,z,1540,3,14,rgb('#59d7dc'));
            for(let x=-200;x<1300;x+=180)mesh.box(x,22,z,110,30,14,rgb('#1a2840'));
        }
        for (const progress of [0, 1]) {
            const tangent = raceCoursePoint(progress), yaw = Math.atan2(tangent.dx, tangent.dy), color = rgb(progress ? '#203144' : '#3277ef');
            for (const lane of [-1.5, 1.5]) { const p = world(progress, lane); mesh.box(p[0], p[1] + 22, p[2], 3, 44, 3, color); }
            const p = world(progress);
            if(!progress)mesh.box(p[0], p[1] + 43, p[2], 94, 7, 4, color, yaw);
            else for(let row=0;row<2;row++)for(let i=0;i<12;i++){const offset=(i-5.5)*94/12;mesh.box(p[0]+Math.cos(yaw)*offset,p[1]+41+row*3.5,p[2]-Math.sin(yaw)*offset,94/12,3.5,4,rgb((i+row)%2?'#f8e7bf':'#203144'),yaw);}
            for (let i = 0; i < 16; i++) mesh.quad(world(Math.max(0, progress - .001), -1.42 + i * 2.84 / 16, 1.4), world(Math.min(1, progress + .001), -1.42 + i * 2.84 / 16, 1.4), world(Math.min(1, progress + .001), -1.42 + (i + 1) * 2.84 / 16, 1.4), world(Math.max(0, progress - .001), -1.42 + (i + 1) * 2.84 / 16, 1.4), rgb(i % 2 ? '#fffbea' : '#263444'));
        }
        return mesh;
    }

    private ball(mesh:RaceMesh,position:Position,elapsed:number,reduce:boolean,count:number){
        const progress=position.progress,p=world(progress,position.lane??(position.index%5-2)*.44),tangent=raceCoursePoint(progress),mask=position.effects??0;
        const phase=position.phase??position.index*1.3,afterFinish=progress>=1?Math.max(0,elapsed-(position.finishMs??elapsed)):0;
        const settling=1-Math.exp(-afterFinish/2200),runout=(55+Math.min(5,Math.floor(position.index/9))*12+Math.sin(phase)*8)*settling,spread=((position.index%9)-4)*10*settling;
        p[0]+=tangent.dx*runout-tangent.dy*spread;p[2]+=tangent.dy*runout+tangent.dx*spread;
        const grid=(1-Math.min(1,progress/.09))*(12+(Math.sin(phase)+1)*Math.max(12,Math.min(65,Math.sqrt(count)*4)));
        p[0]-=tangent.dx*grid;p[2]-=tangent.dy*grid;
        for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6;mesh.triangle([p[0],p[1]+.8,p[2]],[p[0]+Math.cos(a)*7.8,p[1]+.8,p[2]+Math.sin(a)*5],[p[0]+Math.cos(b)*7.8,p[1]+.8,p[2]+Math.sin(b)*5],rgb('#755c3d'));}
        const roll=reduce?phase:(progress*RACE_VISUAL_COURSE_LENGTH+runout)/7.2+phase;
        const yaw=Math.atan2(tangent.dx,tangent.dy);
        if(mask&(RaceEffect.STRIKE|RaceEffect.SPIN|RaceEffect.PERFECT)){
            const tint=rgb(mask&RaceEffect.PERFECT?'#ddd4ff':mask&RaceEffect.SPIN?'#ff725c':'#75f0d3');
            for(let i=0;i<3;i++){const offset=10+i*5;mesh.diamond(p[0]-tangent.dx*offset,p[1]+3,p[2]-tangent.dy*offset,2.4-i*.5,tint);}
        }
        return{point:p,head:[p[0],p[1]+25,p[2]] as Vec3,roll,yaw};
    }

    render(ctx: CanvasRenderingContext2D, width: number, height: number, participants: LotteryParticipant[], positions: Position[], elapsed: number, followed: number | null, reduce: boolean, plan: LotteryRacePlan | null, overview: boolean, playbackMs?: number, expanded=false) {
        const gl = this.gl;
        if (gl.isContextLost()) throw new Error('Scene context lost');
        const tracked=positions.find(p=>p.index===followed),target=tracked??positions[0],now=performance.now(),delta=Math.max(0,Math.min(100,now-this.lastPaint));this.lastPaint=now;
        // A lone leader should not pull the whole pack out of the default view.
        // The broadcast changes sides once, even if an item sends the leader backwards.
        const finishView=raceFinishView(plan,elapsed,playbackMs,reduce);
        const finishLocked=finishView.locked&&followed===null&&!overview;
        this.cameraPhaseProgress=Math.max(this.cameraPhaseProgress,finishLocked?1:positions[0]?.progress??0);
        const group=positions[Math.min(positions.length-1,Math.floor(positions.length*(.25+.25*cameraTurn(this.cameraPhaseProgress))))];
        const progress=finishLocked?1:tracked?.progress??((target?.progress??0)*.55+(group?.progress??0)*.45);
        const staticView=!plan||elapsed<=0||elapsed>=plan.simulationEndMs;
        const changedView=this.previousOverview!==overview||this.previousFollowed!==followed||this.previousExpanded!==expanded;
        if(this.cameraProgress===null||reduce||staticView&&changedView)this.cameraProgress=progress;
        else this.cameraProgress+=(progress-this.cameraProgress)*(1-Math.exp(-delta/500));
        const {eye,look}=lotteryRaceCamera(this.cameraProgress,width/height,overview,this.cameraPhaseProgress,finishView.lowerDegrees+(expanded?10:0)),easing=1-Math.exp(-delta/320);
        if(!this.eye||reduce||staticView&&changedView){this.eye=eye;this.look=look;}
        else for(let i=0;i<3;i++){this.eye[i]+=(eye[i]-this.eye[i])*easing;this.look![i]+=(look[i]-this.look![i])*easing;}
        this.previousOverview=overview;this.previousFollowed=followed;this.previousExpanded=expanded;
        const matrix = raceMatrixMultiply(racePerspective(width / height, overview ? 1 : 1.15*finishView.zoom*(expanded?1.1*1.05:1)), raceViewMatrix(this.eye, this.look!));
        const project = (p: Vec3) => raceProject(matrix, p, width, height);
        const dynamic = new RaceMesh(), pickups = plan?.pickups ?? this.previewPickups;
        const remaining = pickups.filter(item => item.collectedAt === null || item.collectedAt > elapsed);
        for (const item of remaining) { const p = world(item.progress, item.lane, 6 + (reduce ? 0 : Math.sin(elapsed / 250 + item.id) * 1.5)); if(item.kind==='bowlingPin')dynamic.bowlingPin(p[0],p[1]-6,p[2],.85);else dynamic.diamond(...p, 3.4, rgb(RACE_ITEMS.find(k=>k.key===item.kind)!.color)); }
        const priority = positions.filter((p, rank) => rank < 6 || p.index === followed), priorityIds = new Set(priority.map(p => p.index));
        const visible = [...priority, ...positions.filter(p => !priorityIds.has(p.index) && (Math.abs(p.progress-progress)<.45 || overview)).slice(0, 210)];
        const people = visible.map(p => ({ ...p, ...this.ball(dynamic, p, elapsed, reduce, participants.length) }));
        const recent = plan ? raceRecentEvents(plan, elapsed, 3500).slice(-180) : [];
        for(const event of recent.filter(e=>e.kind==='dry'&&e.phase==='trap'&&elapsed-e.time<3000)){const a=Math.max(0,event.progress-.029),b=Math.min(1,event.progress+.029);dynamic.quad(world(a,event.lane-.9,1.4),world(b,event.lane-.9,1.4),world(b,event.lane+.9,1.4),world(a,event.lane+.9,1.4),rgb('#a8844d'));}
        for(const event of recent.filter(e=>e.phase==='use'&&['pinShot','kingPin','split','dry','turkey'].includes(e.kind))){
            const duration=event.kind==='dry'?400:600,age=elapsed-event.time;if(age>duration)continue;
            const start=world(event.progress,event.lane,10),targets=event.kind==='dry'?[null]:event.targets.map(index=>positions.find(p=>p.index===index)??null);
            for(const target of targets){
                const end=target?world(target.progress,target.lane??0,7):world(Math.min(1,event.progress+.03),event.lane,2),t=age/duration;
                const p=start.map((v,i)=>v+(end[i]-v)*t) as Vec3;p[1]+=Math.sin(t*Math.PI)*14;
                if(event.kind==='pinShot'||event.kind==='kingPin')dynamic.bowlingPin(...p,event.kind==='kingPin'?.9:.65);
                else if(event.kind==='turkey'){for(const yaw of [-Math.PI/4,Math.PI/4])dynamic.box(p[0],p[1],p[2],14,3,3,rgb('#ff5d58'),yaw);}
                else if(event.kind==='split')dynamic.box(p[0],p[1],p[2],14,5,3,rgb('#ffaccc'));
                else dynamic.diamond(...p,4,rgb('#dfb05c'));
            }
        }
        gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.055,.09,.15,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.matrix,false,matrix);gl.uniformMatrix4fv(this.model,false,identity);gl.uniform1f(this.ballLighting,0);
        const bind=(buffer:WebGLBuffer)=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(this.color);gl.vertexAttribPointer(this.color,3,gl.FLOAT,false,24,12);};
        bind(this.staticBuffer);gl.drawArrays(gl.TRIANGLES,0,this.count);
        bind(this.dynamicBuffer);
        if(!this.dynamicStorage.length||dynamic.values.length>this.dynamicStorage.length){this.dynamicStorage=new Float32Array(2**Math.ceil(Math.log2(Math.max(1024,dynamic.values.length))));gl.bufferData(gl.ARRAY_BUFFER,this.dynamicStorage.byteLength,gl.DYNAMIC_DRAW);}
        this.dynamicStorage.set(dynamic.values);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.dynamicStorage.subarray(0,dynamic.values.length));if(dynamic.values.length)gl.drawArrays(gl.TRIANGLES,0,dynamic.values.length/6);
        bind(this.ballBuffer);gl.uniform1f(this.ballLighting,1);
        for(const ball of people){gl.uniformMatrix4fv(this.model,false,raceBallMatrix([ball.point[0],ball.point[1]+8,ball.point[2]],ball.roll,ball.yaw,7.2,this.ballTransform));gl.drawArrays(gl.TRIANGLES,(ball.index%RACE_COLORS.length)*this.ballVertices,this.ballVertices);}
        ctx.clearRect(0, 0, width, height);
        this.labels(ctx, width, height, participants, people, remaining, recent, positions, project, elapsed, followed, overview, expanded);
    }

    private labels(ctx: CanvasRenderingContext2D, width: number, height: number, participants: LotteryParticipant[], people: (Position & { point: Vec3; head: Vec3 })[], pickups: RacePickup[], events: LotteryRacePlan['events'], positions: Position[], project: (p: Vec3) => ReturnType<typeof raceProject>, elapsed: number, followed: number | null, overview: boolean, expanded:boolean) {
        const label = (text: string, x: number, y: number, gold = false) => {
            ctx.font = '800 11px sans-serif'; const w = ctx.measureText(text).width + 12; x = Math.max(w / 2 + 4, Math.min(width - w / 2 - 4, x));
            ctx.fillStyle = gold ? '#ffe4a1' : '#172d3fc9'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 16, w, 21, 5); ctx.fill(); ctx.fillStyle = gold ? '#5a3f10' : '#fff'; ctx.textAlign = 'center'; ctx.fillText(text, x, y - 2);
        };
        for (const item of pickups) {
            const p = project(world(item.progress, item.lane, 13)); if (!p || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;
            ctx.font = `${overview ? 11 : Math.min(22, Math.max(12, p.scale * 12))}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(RACE_ITEMS.find(k => k.key === item.kind)!.icon, p.x, p.y);
        }
        for (const progress of [0, 1]) { const p = project(world(progress, 0, 50)); if (p && p.x > 0 && p.x < width && p.y > 10 && p.y < height) label(progress ? 'FINISH' : 'START', p.x, p.y); }
        const ranks = new Map(positions.map((p, i) => [p.index, i]));
        const labels = people.map(p => ({ ...p, screen: project(p.head) })).filter(p => p.screen && p.screen.x > 0 && p.screen.x < width && p.screen.y > 8 && p.screen.y < height - 30).sort((a, b) => (ranks.get(a.index) ?? 0) - (ranks.get(b.index) ?? 0));
        // Both renderers use the same effect flags as the actual bowling simulation.
        for(const runner of people){
            const foot=project(runner.point),mask=runner.effects??0;if(!foot||foot.x< -40||foot.x>width+40||foot.y< -40||foot.y>height+40)continue;
            const radius=Math.min(23,Math.max(8,foot.scale*11));
            if(mask&(RaceEffect.SPARE|RaceEffect.PROTECTED)){ctx.strokeStyle=mask&RaceEffect.PROTECTED?'#e0c6ff':'#9de7ff';ctx.fillStyle='#9cdbff25';ctx.lineWidth=2;ctx.beginPath();ctx.arc(foot.x,foot.y-radius*.7,radius*1.3,0,Math.PI*2);ctx.fill();ctx.stroke();}
            const icons=raceEffectIcons(mask).slice(0,2).join('');
            if(icons){ctx.font=`${Math.min(20,Math.max(11,radius))}px sans-serif`;ctx.textAlign='center';ctx.fillText(icons,foot.x+radius,foot.y-radius);}
        }
        ctx.font = raceNameStyle(width,expanded).font;
        const names=layoutRaceNames(labels.map(runner=>({index:runner.index,rank:ranks.get(runner.index),text:participantName(participants[runner.index]),x:runner.screen!.x,y:runner.screen!.y,priority:runner.index===followed||(ranks.get(runner.index)??0)<3,gold:runner.index===followed||ranks.get(runner.index)===0})),width,height,text=>ctx.measureText(text).width,expanded);
        if(!expanded)paintRaceNames(ctx,names,width);
        for (const event of events) {
            const source = project(world(event.progress, event.lane, 8)); if (!source) continue; const age = elapsed - event.time;
            if(event.phase==='use'&&event.kind==='turkey'&&age<600){ctx.font='bold 17px sans-serif';ctx.textAlign='center';if(age<150)ctx.fillText('❌❌❌',source.x,source.y-25);else for(const index of event.targets){const target=positions.find(p=>p.index===index);if(!target)continue;const end=project(world(target.progress,target.lane??0,16));if(end){const t=(age-150)/450;ctx.fillText('❌',source.x+(end.x-source.x)*t,source.y+(end.y-source.y)*t-16);}}}
            if (age<1100&&(event.phase === 'hit' || event.phase === 'trap' || event.phase === 'block')) { ctx.globalAlpha = Math.max(0, 1 - age / 1100); ctx.strokeStyle = event.kind === 'dry' ? '#ddad67' : '#ffed90'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(source.x, source.y, 8 + age / 25, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }

        }
        // Keep enlarged names readable above item explosions and projectiles.
        if(expanded)paintRaceNames(ctx,names,width,true);
    }

    dispose() { this.gl.deleteBuffer(this.staticBuffer); this.gl.deleteBuffer(this.dynamicBuffer); this.gl.deleteBuffer(this.ballBuffer); this.gl.deleteProgram(this.program); }
}
