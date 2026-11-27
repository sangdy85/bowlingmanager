'use client';

import Image from 'next/image';
import { useState } from 'react';
import styles from './ManufacturerEquipment.module.css';

type Photo = { src: string; alt: string; width: number; height: number };

export default function ProductPhoto({ image, detail = false }: { image?: Photo; detail?: boolean }) {
    const [failedSrc, setFailedSrc] = useState<string>();
    return <div className={`${styles.photo} ${detail ? styles.detailPhoto : ''}`}>
        {image && failedSrc !== image.src ? <Image
            src={image.src} alt={image.alt} width={image.width} height={image.height}
            sizes={detail ? '(max-width: 650px) 90vw, 560px' : '(max-width: 650px) 90vw, (max-width: 950px) 45vw, 360px'}
            priority={detail} onError={() => setFailedSrc(image.src)}
        /> : <div className={styles.photoFallback}><span aria-hidden="true">🎳</span><span>제품 사진</span><p>사진을 불러오지 못했습니다.<br />아래 공식 제품 링크에서 확인해주세요.</p></div>}
    </div>;
}
