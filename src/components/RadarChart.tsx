"use client";

import React from "react";

interface RadarChartProps {
    datasets: {
        label: string;
        color: string;
        points: number[]; // 5 points
    }[];
    labels: string[]; // 5 labels
    size?: number;
}

const RadarChart: React.FC<RadarChartProps> = ({ datasets, labels, size = 320 }) => {
    const radius = size / 4; // Smaller chart for more label space
    const center = size / 2;
    const angleStep = (Math.PI * 2) / 5;

    const getCoordinates = (value: number, angle: number) => {
        // value is 0-10
        const r = (value / 10) * radius;
        const x = center + r * Math.sin(angle);
        const y = center - r * Math.cos(angle);
        return { x, y };
    };

    const levels = [2, 4, 6, 8, 10];

    return (
        <div className="flex flex-col items-center w-full h-full justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible min-w-[300px]">
                {/* Background Polygons (Grid) */}
                {levels.map((level) => {
                    const points = labels.map((_, i) => {
                        const { x, y } = getCoordinates(level, i * angleStep);
                        return `${x},${y}`;
                    }).join(" ");
                    return (
                        <polygon
                            key={level}
                            points={points}
                            fill="none"
                            stroke="#ffffff"
                            strokeOpacity="0.1"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Axis Lines */}
                {labels.map((_, i) => {
                    const { x, y } = getCoordinates(10, i * angleStep);
                    return (
                        <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={x}
                            y2={y}
                            stroke="#ffffff"
                            strokeOpacity="0.15"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Datasets */}
                {datasets.map((dataset, idx) => {
                    const points = dataset.points.map((val, i) => {
                        const { x, y } = getCoordinates(val, i * angleStep);
                        return `${x},${y}`;
                    }).join(" ");
                    return (
                        <g key={idx}>
                            <polygon
                                points={points}
                                fill={dataset.color}
                                fillOpacity="0.2"
                                stroke={dataset.color}
                                strokeWidth="2"
                                className="transition-all duration-500"
                            />
                            {dataset.points.map((val, i) => {
                                const { x, y } = getCoordinates(val, i * angleStep);
                                return (
                                    <circle
                                        key={i}
                                        cx={x}
                                        cy={y}
                                        r="3"
                                        fill={dataset.color}
                                    />
                                );
                            })}
                        </g>
                    );
                })}

                {/* Labels */}
                {labels.map((label, i) => {
                    const { x, y } = getCoordinates(15, i * angleStep); // Much further outside
                    return (
                        <text
                            key={i}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[13px] font-black"
                            style={{ fill: '#f8fafc', filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,1))' }}
                        >
                            {label}
                        </text>
                    );
                })}
            </svg>
            
            {/* Legend */}
            {/* Legend - Subtle and Integrated */}
            <div className="flex gap-6 mt-6 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full shadow-lg">
                {datasets.map((dataset, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: dataset.color }}></div>
                        <span className="text-[11px] font-black text-white/90 uppercase tracking-wider">{dataset.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RadarChart;
