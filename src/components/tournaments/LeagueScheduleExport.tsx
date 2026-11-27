"use client";

import React from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { formatKSTMonthDay } from '@/lib/tournament-utils';

interface LeagueScheduleExportProps {
    tournamentName: string;
    leagueRounds: any[];
}

export default function LeagueScheduleExport({ tournamentName, leagueRounds }: LeagueScheduleExportProps) {
    const handleDownload = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('대진표');

        // Prepare lane headers
        const lanePairs = Array.from(new Set(leagueRounds.flatMap(r => r.matchups.map((m: any) => m.lanes).filter((l: any) => !!l))))
            .sort((a: any, b: any) => parseInt(a) - parseInt(b));

        const individualLanes: number[] = [];
        lanePairs.forEach((pair: any) => {
            const [start, end] = pair.split('-').map(Number);
            individualLanes.push(start, end);
        });

        // 1. Add Title
        const titleRowValue = `${tournamentName} 상주리그 대진표`;
        const titleRow = worksheet.addRow([titleRowValue]);
        titleRow.font = { size: 16, bold: true };
        worksheet.mergeCells(1, 1, 1, individualLanes.length + 2);
        titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.addRow([]); // Spacer

        // 2. Add Headers
        const headerRowValues = ['회차', '날짜', ...individualLanes.map(l => `${l}레인`)];
        const headerRow = worksheet.addRow(headerRowValues);

        // Header Styling
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFCC00' } // Yellow
            };
            cell.font = { bold: true, color: { argb: '000000' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // 3. Add Data Rows
        leagueRounds.forEach((round) => {
            const dateStr = formatKSTMonthDay(round.date);

            const rowData = [
                `${round.roundNumber}주차`,
                dateStr
            ];

            individualLanes.forEach(lane => {
                const match = round.matchups.find((m: any) => {
                    if (!m.lanes) return false;
                    const [start, end] = m.lanes.split('-').map(Number);
                    return lane === start || lane === end;
                });

                if (match) {
                    const [start, end] = match.lanes?.split('-').map(Number) || [0, 0];
                    const isTeamA = lane === start;
                    const team = isTeamA ? match.teamA : match.teamB;
                    const squad = isTeamA ? match.teamASquad : match.teamBSquad;

                    let displayName = team?.name || "-";
                    if (team?.name && squad) {
                        displayName = `${team.name} (${squad})`;
                    }
                    rowData.push(displayName);
                } else {
                    rowData.push("-");
                }
            });

            const row = worksheet.addRow(rowData);

            // Cell Styling
            row.eachCell((cell, colNumber) => {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                // Date column yellow background
                if (colNumber === 2) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFCC00' }
                    };
                    cell.font = { bold: true };
                }

                if (colNumber === 1) {
                    cell.font = { bold: true };
                }
            });
        });

        // 4. Set Column Widths
        worksheet.getColumn(1).width = 12;
        worksheet.getColumn(2).width = 15;
        for (let i = 3; i <= individualLanes.length + 2; i++) {
            worksheet.getColumn(i).width = 18;
        }

        // 5. Generate and Save
        const buffer = await workbook.xlsx.writeBuffer();
        const data = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(data, `${tournamentName}_대진표.xlsx`);
    };

    return (
        <button
            onClick={handleDownload}
            className="btn btn-primary flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm border-2 border-black"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel 다운로드
        </button>
    );
}
