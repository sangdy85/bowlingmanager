export type RaceNameLabel = { index: number; text: string; x: number; y: number; priority: boolean; gold: boolean; rank?: number };
export type RaceLabelBox = RaceNameLabel & { anchorX: number; anchorY: number; w: number };
/** CSS pixels, independent of camera zoom and device pixel ratio. */
export function raceNameStyle(width:number,expanded=false){
    const size=expanded?(width<600?11:width<1000?13:16):11;
    return {size,font:`${expanded?900:800} ${size}px sans-serif`,h:expanded?size+7:21,top:expanded?size+3:16,pad:expanded?10:12,gap:expanded?3:2,radius:expanded?4:5};
}
/** Quiet overhead labels: leaders and the selected ball only, without a rotating name grid. */
export function layoutRaceNames(candidates: RaceNameLabel[], width: number, height: number, measure: (text: string) => number, expanded=false): RaceLabelBox[] {
    const style=raceNameStyle(width,expanded),step=expanded?style.h+style.gap:24;
    const leaderCount = width < 600 ? 5 : 10;
    const selected = candidates.filter(p => (p.rank ?? p.index) < leaderCount || p.gold);
    selected.sort((a, b) => Number(b.gold) - Number(a.gold) || (a.rank ?? a.index) - (b.rank ?? b.index));
    const labels: RaceLabelBox[] = [];
    for (const candidate of selected) {
        let text = candidate.text;
        const maximum=expanded?Math.min(width<600?120:180,width*.6,width-20):Math.min(180,width-20);
        while (text.length > 2 && measure(text) + style.pad > maximum) text = text.slice(0, -2) + '…';
        const w = measure(text) + style.pad;
        placement: for (const offset of [0, -step, -step*2, -step*3, step, step*2]) {
            for (const sideways of [0, -w - 8, w + 8]) {
                const y = candidate.y + offset, x = Math.max(w / 2 + 6, Math.min(width - w / 2 - 6, candidate.x + sideways));
                if (y < Math.max(24,style.top+6) || y > height - 54 || labels.some(p => Math.abs(p.x - x) < (p.w + w) / 2 + 4 && Math.abs(p.y - y) < style.h+style.gap)) continue;
                labels.push({ ...candidate, text, x, y, w, anchorX: candidate.x, anchorY: candidate.y });
                break placement;
            }
        }
    }
    return labels;
}

/** The same high-contrast name boxes in WebGL overlays and the 2D fallback. */
export function paintRaceNames(ctx:CanvasRenderingContext2D,names:RaceLabelBox[],width:number,expanded=false){
    const style=raceNameStyle(width,expanded);ctx.save();ctx.font=style.font;ctx.textAlign='center';
    for(const name of names){
        if(Math.hypot(name.x-name.anchorX,name.y-name.anchorY)>14){ctx.strokeStyle=expanded?'#d1e6f5aa':'#18364645';ctx.lineWidth=expanded?1.2:.7;ctx.beginPath();ctx.moveTo(name.anchorX,name.anchorY);ctx.lineTo(name.x,name.y+5);ctx.stroke();}
    }
    for(const name of names){
        ctx.fillStyle=name.gold?'#ffe4a1':expanded?'#10243b':'#172d3fc9';ctx.beginPath();ctx.roundRect(name.x-name.w/2,name.y-style.top,name.w,style.h,style.radius);ctx.fill();
        if(expanded){ctx.strokeStyle=name.gold?'#fff1bd':'#d1e6f5bb';ctx.lineWidth=.75;ctx.stroke();}
        ctx.fillStyle=name.gold?'#483009':'#fff';ctx.fillText(name.text,name.x,name.y-2);
    }
    ctx.restore();
}
