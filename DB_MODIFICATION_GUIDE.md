# 데이터베이스 직접 조회 및 수정 가이드

임시로 생성했던 수정 페이지와 서버 액션은 모두 삭제되었습니다. 이제 데이터베이스를 직접 조회하고 수정하는 방법을 안내해 드립니다.

## 1. Prisma Studio 활용 (가장 추천)
GUI를 통해 엑셀처럼 데이터를 직접 보고 수정할 수 있습니다. 로컬 환경에서 실행하여 실서버 DB에 접속할 수 있습니다.

```powershell
# 프로젝트 폴더에서 실행
npx prisma studio
```
실행 후 브라우저가 열리면 `LeagueMatchup` 테이블을 찾아 데이터를 직접 수정하고 `Save Changes`를 누르시면 됩니다.

## 2. 특정 데이터 조회를 위한 스크립트 실행
ID 불일치 등으로 대상을 찾기 어려울 때, 제가 미리 만들어둔 조회 스크립트를 활용하세요.

```powershell
# 모든 대회 이름과 ID 리스트 조회
node scripts/check-admins.js

# 특정 대회(예: 19차)의 16주차 매치업 상세 정보 조회
node scripts/find-matchup-ids.js
```

## 3. 직접 수정을 위한 임시 스크립트 작성 예시
데이터가 많아 일일이 수정하기 힘들 때, 아래와 같은 파일을 `scripts/fix-data.js`로 만들어 실행할 수 있습니다.

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.leagueMatchup.update({
    where: { id: "여기에_조회한_ID_입력" },
    data: { teamASquad: "A" } // 혹은 "B"
  });
  console.log("수정 완료:", result);
}

main().finally(() => prisma.$disconnect());
```

명령어 실행: `node scripts/fix-data.js`
