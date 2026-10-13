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
    appearance?: "light" | "dark";
}

const RadarChart: React.FC<RadarChartProps> = ({ datasets, labels, size = 320, appearance = "dark" }) => {
    const descriptionId = React.useId();
    const radius = size * (appearance === "light" ? 0.29 : 0.25);
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
        <div className="relative flex flex-col items-center w-full h-full justify-center">
            <svg
                style={{ width: "100%", height: "auto", maxWidth: size }}
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="w-full max-w-[500px] h-auto overflow-visible"
                role="img"
                aria-label="개인 기록 오각형 그래프"
                aria-describedby={descriptionId}
            >
                <desc id={descriptionId}>{`0–10 척도. ${datasets.map(dataset => `${dataset.label}: ${labels.map((label, index) => `${label} ${dataset.points[index].toFixed(1)}`).join(", ")}`).join(". ")}`}</desc>
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
                            stroke={appearance === "light" ? "#475569" : "#ffffff"}
                            strokeOpacity={appearance === "light" ? "0.22" : "0.1"}
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
                            stroke={appearance === "light" ? "#475569" : "#ffffff"}
                            strokeOpacity={appearance === "light" ? "0.25" : "0.15"}
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
                                strokeWidth={appearance === "light" ? 2.5 : 2}
                                strokeDasharray={appearance === "light" && idx > 0 ? "6 4" : undefined}
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
                    const { x, y } = getCoordinates(appearance === "light" ? 13.2 : 15, i * angleStep);
                    return (
                        <text
                            key={i}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[13px] font-black"
                            style={{ fontSize: appearance === "light" ? 15 : undefined, fontWeight: 700, fill: appearance === "light" ? "#475569" : "#f8fafc", filter: appearance === "light" ? undefined : "drop-shadow(0px 0px 3px rgba(0,0,0,1))" }}
                        >
                            {label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
};

export default RadarChart;
