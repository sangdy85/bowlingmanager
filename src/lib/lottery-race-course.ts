export const RACE_COURSE_LENGTH = 480;
export type Terrain = { label: '평지' | '오르막' | '내리막'; multiplier: number; height: number };
export function raceTerrain(progress: number): Terrain {
    const p = Math.max(0, Math.min(1, progress));
    // Cosine hills have flat tangents at their feet and crest; speed blends into
    // each slope instead of changing abruptly at a terrain boundary.
    for(const [start,end,height,up,down] of [[.14,.42,18,.72,1.25],[.50,.78,28,.68,1.30]]){
        if(p<start||p>=end)continue;
        const t=(p-start)/(end-start),grade=Math.sin(2*Math.PI*t);
        return {label:t<.5?'오르막':'내리막',multiplier:1+(grade>=0?up-1:1-down)*grade,height:height*(1-Math.cos(2*Math.PI*t))/2};
    }
    return { label: '평지', multiplier: 1, height: 0 };
}
const bends = [
    [[50,1050],[400,1050],[950,1000],[950,800]],
    [[950,800],[950,600],[150,700],[150,500]],
    [[150,500],[150,300],[950,400],[950,200]],
    [[950,200],[950,0],[600,50],[200,50]],
];
// Broad, tangent-continuous bends keep the full road ribbon smooth at each hairpin.
const curve = (t: number) => {
    const scaled=Math.max(0,Math.min(.999999,t))*bends.length,index=Math.floor(scaled),f=scaled-index,u=1-f;
    const [a,b,c,d]=bends[index];
    return [0,1].map(k=>(u*u*u*a[k]+3*u*u*f*b[k]+3*u*f*f*c[k]+f*f*f*d[k])*.8+(k===0?100:110));
};
const samples=Array.from({length:513},(_,i)=>{const p=curve(i/512);return {x:p[0],y:p[1],distance:0};});
for(let i=1;i<samples.length;i++)samples[i].distance=samples[i-1].distance+Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y);
const total=samples[samples.length-1].distance;
export const RACE_VISUAL_COURSE_LENGTH=total;
/** Arc-length sampling keeps bends from secretly changing a player's travel distance. */
export function raceCoursePoint(progress: number) {
    const wanted=Math.max(0,Math.min(1,progress))*total;
    let low=0,high=samples.length-1;
    while(high-low>1){const middle=(low+high)>>1;if(samples[middle].distance<wanted)low=middle;else high=middle;}
    const a=samples[low],b=samples[high],t=(wanted-a.distance)/Math.max(.001,b.distance-a.distance);
    const length=Math.hypot(b.x-a.x,b.y-a.y)||1;
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,dx:(b.x-a.x)/length,dy:(b.y-a.y)/length,height:raceTerrain(progress).height};
}
