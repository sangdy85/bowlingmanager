'use server';
import { saveCommunityPost } from '@/app/actions/community';
import { EquipmentInputError, type EquipmentInput } from '@/lib/equipment';

export async function saveEquipmentPost(id: string | null, input: {title:string;content:string;equipment:EquipmentInput}) {
    try {
        if (!input?.equipment) return {error:'제품 정보를 입력해주세요.'};
        const post=await saveCommunityPost(id,{...input,category:'EQUIPMENT'});
        return {id:post.id};
    } catch(error) {
        return {error:error instanceof EquipmentInputError ? error.message : '저장하지 못했습니다. 로그인·작성 권한과 입력 내용을 확인해주세요. 새 글은 1분 간격으로 등록할 수 있습니다.'};
    }
}
