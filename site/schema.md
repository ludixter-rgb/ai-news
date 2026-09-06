# 데스크 데이터 구조

대시보드는 Artifact의 `db`에서 읽는다. 문서는 두 종류고, 쓰는 주체가 다르다.

| 경로 | 쓰는 쪽 | 내용 |
|---|---|---|
| `briefs/YYYY-MM-DD` | 매일 아침 조사 세션 | 그날 조사 결과 |
| `decisions/YYYY-MM-DD` | 대시보드 화면 | 항목별 승인 상태와 `오늘의 한 건` |

**나눠 둔 이유** — 같은 날 조사가 다시 돌아 `briefs`를 덮어써도, 찍어둔 결정이 날아가지 않는다.

## briefs/YYYY-MM-DD

```json
{
  "date": "2026-09-06",
  "windowHours": 24,
  "generatedAt": "2026-09-06T08:05:00+09:00",
  "note": "창을 넓혔거나 항목이 없을 때의 한 줄 설명 (선택)",
  "items": [
    {
      "id": "서비스-기능 슬러그. 결정 상태가 이 값에 붙으므로 날짜 안에서 고유해야 한다",
      "level": "high | cond",
      "service": "챗GPT",
      "title": "기능명이 아니라 결과로 쓴 한 줄",
      "changed": "이전에는 ~, 지금은 ~. 2~3문장",
      "who": "요금제 / 지역 / 플랫폼 / 롤아웃 범위. 확인 안 된 것은 '확인 안 됨'",
      "sources": [{ "url": "https://...", "label": "매체 또는 문서 이름", "date": "9월 5일" }]
    }
  ],
  "checks":   [{ "note": "확인 못 한 것", "reason": "왜" }],
  "filtered": [{ "note": "뺀 소식",     "reason": "어느 기준에 걸렸는지" }]
}
```

- `level` — `high`는 앱을 열면 바로 보이는 변화, `cond`는 일부 이용자·조건부·단계적 롤아웃
- `sources`가 빈 배열이면 화면에 **출처 미기재 — 발행 전 확인 필요**로 표시된다
- `items`가 빈 배열이면 조용한 날로 렌더링된다. `note`에 이유를 적는다
- 한 문서 256KB 제한. 하루치는 여기 한참 못 미친다

## decisions/YYYY-MM-DD

```json
{
  "items": { "항목id": "approved | hold | dropped" },
  "pick": "오늘의 한 건으로 고른 항목id 또는 null",
  "updatedAt": "2026-09-06T09:12:00+09:00"
}
```

조사 세션은 이 문서를 건드리지 않는다. 승인은 사람이 찍는다.

## 쓰는 법

```
Artifact 도구 · action: write_db · db_op: set
url:        <데스크 Artifact 주소>
collection: briefs
doc_id:     2026-09-06
file_path:  brief.json      ← 위 구조의 JSON 파일
```
