const DB_NAME = 'bowlingmanager-band-photo-helper';
async function database() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('pending');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(Error('사진 임시 저장소를 열지 못했습니다.'));
    });
}
async function transaction(mode, operation) {
    const db = await database();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction('pending', mode);
            const request = operation(tx.objectStore('pending'));
            tx.oncomplete = () => resolve(request.result);
            tx.onabort = tx.onerror = () => reject(Error('사진 임시 저장 작업에 실패했습니다.'));
        });
    } finally { db.close(); }
}
export const clearPacket = () => transaction('readwrite', store => store.clear());
export const putPacket = packet => transaction('readwrite', store => store.put(packet, 'current'));
export async function getPacket(now = Date.now()) {
    const packet = await transaction('readonly', store => store.get('current'));
    if (packet && now >= packet.expiresAt) { await clearPacket(); return null; }
    return packet || null;
}
