export type Vec3 = [number, number, number];
export type Color = [number, number, number];
export const rgb = (hex: string): Color => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as Color;
const subtract = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v - b[i]) as Vec3;
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const normalize = (a: Vec3): Vec3 => { const length = Math.hypot(...a) || 1; return a.map(v => v / length) as Vec3; };
export function raceViewMatrix(eye: Vec3, target: Vec3) {
    const z = normalize(subtract(eye, target)), x = normalize(cross([0, 1, 0], z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}
export function racePerspective(aspect: number, zoom = 1) {
    const f = zoom / Math.tan(48 * Math.PI / 360), near = 1, far = 8000;
    return new Float32Array([f / Math.max(.1, aspect), 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}
export function raceMatrixMultiply(a: Float32Array, b: Float32Array) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
    return out;
}
/** Reuse a cached unit sphere; only its transform changes on each frame. */
export function raceBallMatrix(point:Vec3,roll:number,yaw:number,radius=7.2,out=new Float32Array(16)){
    const cr=Math.cos(roll),sr=Math.sin(roll),cy=Math.cos(yaw),sy=Math.sin(yaw);
    out.set([cy*radius,0,-sy*radius,0,sr*sy*radius,cr*radius,sr*cy*radius,0,cr*sy*radius,-sr*radius,cr*cy*radius,0,point[0],point[1],point[2],1]);
    return out;
}
export function raceProject(matrix: Float32Array, point: Vec3, width: number, height: number) {
    const clip = [0, 1, 2, 3].map(row => matrix[row] * point[0] + matrix[4 + row] * point[1] + matrix[8 + row] * point[2] + matrix[12 + row]);
    if (clip[3] <= 1 || clip[2] < -clip[3] || clip[2] > clip[3]) return null;
    return { x: (clip[0] / clip[3] + 1) * width / 2, y: (1 - clip[1] / clip[3]) * height / 2, scale: height / clip[3], depth: clip[3] };
}
/** Flat-shaded, original geometry. Six floats per vertex: position then RGB. */
export class RaceMesh {
    values: number[] = [];
    triangle(a: Vec3, b: Vec3, c: Vec3, color: Color, shade = 1) {
        for (const p of [a, b, c]) this.values.push(...p, ...color.map(v => Math.max(0, Math.min(1, v * shade))));
    }
    quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Color, shade = 1) { this.triangle(a, b, c, color, shade); this.triangle(a, c, d, color, shade); }
    box(x: number, y: number, z: number, w: number, h: number, d: number, color: Color, yaw = 0) {
        const vertices: Vec3[] = [];
        for (const dz of [-d / 2, d / 2]) for (const dy of [-h / 2, h / 2]) for (const dx of [-w / 2, w / 2]) vertices.push([x + dx * Math.cos(yaw) + dz * Math.sin(yaw), y + dy, z - dx * Math.sin(yaw) + dz * Math.cos(yaw)]);
        for (const [indices, shade] of [[[0, 1, 3, 2], .76], [[4, 6, 7, 5], 1], [[0, 4, 5, 1], .6], [[2, 3, 7, 6], 1.12], [[0, 2, 6, 4], .86], [[1, 5, 7, 3], .91]] as [number[], number][]) this.quad(vertices[indices[0]], vertices[indices[1]], vertices[indices[2]], vertices[indices[3]], color, shade);
    }
    cone(x: number, y: number, z: number, radius: number, height: number, color: Color, sides = 5) {
        for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2; this.triangle([x + Math.cos(a) * radius, y, z + Math.sin(a) * radius], [x, y + height, z], [x + Math.cos(b) * radius, y, z + Math.sin(b) * radius], color, .7 + i / sides * .4); }
    }
    diamond(x: number, y: number, z: number, radius: number, color: Color) {
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, b = (i + 1) * Math.PI / 2, p: Vec3 = [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius], q: Vec3 = [x + Math.cos(b) * radius, y, z + Math.sin(b) * radius]; this.triangle(p, [x, y + radius * 1.4, z], q, color, 1.1 - i * .1); this.triangle(q, [x, y - radius, z], p, color, .75); }
    }
    /** A rolling marbled sphere with three dark finger holes. No external texture. */
    bowlingBall(x:number,y:number,z:number,radius:number,color:Color,roll=0,yaw=0,pattern=0,materialOnly=false){
        const cr=Math.cos(roll),sr=Math.sin(roll),cy=Math.cos(yaw),syaw=Math.sin(yaw);
        const rotate=(p:Vec3):Vec3=>{
            const sy=p[1]*cr-p[2]*sr,sz=p[1]*sr+p[2]*cr;
            return [p[0]*cy+sz*syaw,sy,-p[0]*syaw+sz*cy];
        };
        const place=(p:Vec3):Vec3=>{const r=rotate(p);return[x+r[0]*radius,y+r[1]*radius,z+r[2]*radius];};
        const surface=(lat:number,lon:number):Vec3=>[Math.sin(lat)*Math.cos(lon),Math.cos(lat),Math.sin(lat)*Math.sin(lon)];
        // Per-vertex lighting and marble color interpolate across triangles, giving
        // the ball a polished round surface instead of a faceted checkerboard.
        const vertices:{point:Vec3;color:Color}[]=[];
        for(let row=0;row<=12;row++)for(let col=0;col<=20;col++){
            const lat=row/12*Math.PI,lon=col/20*Math.PI*2,unit=surface(lat,lon),normal=rotate(unit),marble=(Math.sin(lon*3+lat*4+pattern*1.7)+1)/2;
            const light=.7+.3*Math.max(0,normal[0]*-.35+normal[1]*.8+normal[2]*.45),shine=Math.pow(Math.max(0,normal[0]*-.35+normal[1]*.7+normal[2]*.62),18)*.4;
            vertices.push({point:place(unit),color:color.map(v=>Math.min(1,(v*(.65+marble*.35)+marble*.12)*(materialOnly?1:light)+(materialOnly?0:shine))) as Color});
        }
        for(let row=0;row<12;row++)for(let col=0;col<20;col++){
            const a=row*21+col,b=a+21;
            for(const index of [a,b,b+1,a,b+1,a+1]){const v=vertices[index];this.values.push(...v.point,...v.color);}
        }
        for(const n of [[-.25,.70,-.67],[.25,.70,-.67],[0,.32,-.95]] as Vec3[]){
            const normal=normalize(n),u=normalize(cross(normal,[1,0,0])),v=cross(normal,u),center=place(normal.map(k=>k*1.006) as Vec3);
            for(let i=0;i<10;i++){
                const edge=(angle:number)=>place(normalize(normal.map((k,j)=>k+(u[j]*Math.cos(angle)+v[j]*Math.sin(angle))*.16) as Vec3).map(k=>k*1.008) as Vec3);
                this.triangle(center,edge(i*Math.PI/5),edge((i+1)*Math.PI/5),rgb('#111c30'));
            }
        }
    }
    bowlingPin(x:number,y:number,z:number,scale=1){
        const profile=[[0,1.7],[1,2.4],[5,2.4],[8,1.3],[10,1],[11,1.1],[12,1.6],[14,1.3],[15,0]];
        for(let row=0;row<profile.length-1;row++)for(let i=0;i<8;i++){
            const [ay,ar]=profile[row],[by,br]=profile[row+1],a=i*Math.PI/4,b=(i+1)*Math.PI/4;
            const point=(h:number,r:number,t:number):Vec3=>[x+Math.cos(t)*r*scale,y+h*scale,z+Math.sin(t)*r*scale];
            this.quad(point(ay,ar,a),point(by,br,a),point(by,br,b),point(ay,ar,b),rgb(row===4||row===5?'#ee5f62':'#fff8e8'),.8+i/8*.2);
        }
    }
    array() { return new Float32Array(this.values); }
}
