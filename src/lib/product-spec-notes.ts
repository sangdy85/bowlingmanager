export type ProductSpecNote = {
  slug: string; model: string; core: string; coverstock: string; finish: string;
  sourceUrl: string; checkedAt: string;
  weights: { lb: number; rg: string; diff: string; mb?: string }[];
  interpretation: string[];
};

// Transcribed from the linked manufacturer detail sheets, including the weight basis.
// Missing MB values mean "not listed", never zero.
export const PRODUCT_SPEC_NOTES: ProductSpecNote[] = [
  {
    slug: 'lordfield-swag-fusion-pearl-875', model: 'FUSION PEARL', core: 'FUSION', coverstock: 'XPLODE PEARL AP26', finish: '#4000 SANDED', checkedAt: '2026-10-30',
    sourceUrl: 'https://www.lordfield.com/web/upload/NNEditor/20261008/FUSION-PEARL.png',
    weights: [{lb:13,rg:'2.596',diff:'0.035'},{lb:14,rg:'2.551',diff:'0.039'},{lb:15,rg:'2.538',diff:'0.041'},{lb:16,rg:'2.483',diff:'0.043'}],
    interpretation: [
      '같은 모델도 13lb의 RG 2.596·Diff 0.035와 16lb의 RG 2.483·Diff 0.043이 다릅니다. 15lb 사양만 보고 가벼운 무게에도 같은 수치가 적용된다고 생각하지 마세요.',
      '아래 세 모델의 15lb 비교에서 RG는 가장 높고 Diff는 중간입니다. 이것만으로 전체 훅의 크기를 정할 수는 없습니다. 커버 이름은 PEARL이지만 출고 표면은 #4000 SANDED로 표기돼 있어, 펄이라는 이유로 유광 폴리시 마감이라고 해석하면 안 됩니다.',
      '현재 공이 너무 일찍 마찰을 받는다고 느낀다면 먼저 기존 공의 표면과 사용 레인 상태를 기록한 뒤 비교하세요. RG 숫자만 바꾸기보다 지공사와 무게·표면·레이아웃을 함께 검토할 수 있습니다.',
    ],
  },
  {
    slug: 'lordfield-swag-black-dragon-hybrid-874', model: 'BLACK DRAGON HYBRID', core: 'DRAGON', coverstock: 'SCORCH HYBRID AP26', finish: '#1500 SANDED', checkedAt: '2026-10-30',
    sourceUrl: 'https://www.lordfield.com/web/upload/NNEditor/20260909/BLACK-DRAGON-HYBRID.png',
    weights: [{lb:13,rg:'2.562',diff:'0.049',mb:'0.014'},{lb:14,rg:'2.532',diff:'0.051',mb:'0.016'},{lb:15,rg:'2.499',diff:'0.051',mb:'0.017'},{lb:16,rg:'2.478',diff:'0.050',mb:'0.018'}],
    interpretation: [
      '15lb 기준 RG 2.499, Diff 0.051, MB 0.017입니다. 이 세 모델 중 같은 무게의 RG가 가장 낮고 Diff는 가장 높습니다. 코어 수치상 회전 전개와 플레어 잠재력을 비교하는 근거이며, 누구에게나 더 많이 꺾이거나 점수가 높아진다는 뜻은 아닙니다.',
      '공식 자료는 MB를 무게별로 따로 표기합니다. 비대칭 코어 비교에 참고하는 값으로 Diff와 같은 항목이 아닙니다. 두 수치를 더해서 훅 점수를 만들거나, MB 표기가 없는 다른 공을 0으로 간주하지 마세요.',
      '출고 표면 #1500 SANDED는 비교 대상의 #3000·#4000과 다릅니다. 숫자가 낮다는 이유만으로 실제 레인에서의 반응을 단정하기보다 오일 양·길이, 구속과 회전, 사용 후 표면 변화를 함께 확인하세요.',
    ],
  },
  {
    slug: 'lordfield-swag-virtue-873', model: 'VIRTUE', core: 'VIRTUE', coverstock: 'SR300 AP26', finish: '#3000 SANDED', checkedAt: '2026-10-30',
    sourceUrl: 'https://www.lordfield.com/web/upload/NNEditor/20260828/VIRTUE.png',
    weights: [{lb:13,rg:'2.571',diff:'0.031'},{lb:14,rg:'2.552',diff:'0.032'},{lb:15,rg:'2.522',diff:'0.032'},{lb:16,rg:'2.508',diff:'0.031'}],
    interpretation: [
      '15lb 기준 RG 2.522·Diff 0.032로, 세 모델의 같은 무게 비교에서 Diff가 가장 낮습니다. 플레어 잠재력이 상대적으로 작은 코어 수치라고 읽을 수 있지만, 초보자에게 무조건 더 쉽다거나 직진 전용 공이라는 의미는 아닙니다.',
      '13~16lb의 Diff가 0.031~0.032로 비슷해도 RG는 2.571에서 2.508로 달라집니다. 같은 모델의 무게를 바꿀 때는 Diff뿐 아니라 RG와 실제로 편하게 던질 수 있는 무게를 함께 확인하세요.',
      '공식 시트에는 커버를 SR300 AP26으로 표기합니다. 이 표기만으로 커버의 모든 성질을 추정하거나 우레탄·스페어 전용이라고 분류하지 않습니다. 판매처에 커버 구성과 기존 공 대비 쓰임을 확인한 후 선택하세요.',
    ],
  },
];

export function productSpecNote(slug: string) { return PRODUCT_SPEC_NOTES.find(note => note.slug === slug); }
