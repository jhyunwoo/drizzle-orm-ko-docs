# Drizzle ORM 한국어 번역 검증 요약

검증 일시: 2026-03-13

## 결론

현재 결과물은 "모든 페이지가 정확하게 한국어로 번역되었다"는 기준을 충족하지 못한다.

## 정량 결과

- 전체 대상 문서: 245개
- 생성된 한국어 문서: 54개
- 누락된 한국어 문서: 191개
- 자동 검증 총 이슈 수: 319개
- MDX 파싱 실패: 44개
- inline code 개수 불일치: 28개
- code fence 개수 불일치: 2개
- 영문 residue 감지: 54개
- `CODEX TERM` 오염 파일 수: 54개
- `CODEX INLINE` 오염 파일 수: 39개
- `카지노사이트` 오염 파일 수: 39개

## 핵심 실패 유형

### 1. 대량 누락

다음과 같이 주요 문서가 아예 생성되지 않았다.

- `src/content/docs-ko/overview.mdx`
- `src/content/docs-ko/get-started.mdx`
- `src/content/docs-ko/faq.mdx`
- `src/content/docs-ko/select.mdx`
- `src/content/docs-ko/set-operations.mdx`
- `src/content/docs-ko/relations-v2.mdx`
- `src/content/docs-ko/seed-functions.mdx`
- `src/content/docs-ko/tutorials.mdx`
- `src/content/docs-ko/latest-releases.mdx`

세부적으로는 다음 그룹에서 누락이 집중되었다.

- `get-started/**`: 52개 누락
- `latest-releases/**`: 37개 누락
- `guides/**`: 25개 누락
- `tutorials/**`: 12개 누락
- `migrate/**`: 4개 누락

## 2. 플레이스홀더 및 비정상 문자열 오염

대표 사례:

- `src/content/docs-ko/connect-drizzle-proxy.mdx`
  - `CODEX TERM` 플레이스홀더가 제목과 본문에 그대로 노출됨
  - `카지노사이트` 문자열이 반복 삽입됨
- `src/mdx-ko/get-started/SetupConfig.mdx`
  - `CODEX TERM`, `CODEX INLINE`가 문장 안에 그대로 남아 있음
  - 본문 중간에 `카지노사이트`가 삽입됨

## 3. 마크다운/MDX 구조 손상

대표 사례:

- `src/content/docs-ko/connect-neon.mdx`
  - `CodeTabs`와 `Section` 태그 구조가 깨져 자동 파싱 실패
- `src/content/docs-ko/cache.mdx`
  - `Callout` 닫는 태그 누락
- `src/content/docs-ko/column-types/mysql.mdx`
  - frontmatter `title`이 `CODEX TERM`으로 오염됨
- `src/mdx-ko/get-started/ApplyChanges.mdx`
  - import/export 파싱 실패

## 4. 번역 품질 및 서식 손상

대표 사례:

- `src/content/docs-ko/connect-overview.mdx`
  - `**` 강조 문법이 `* *`로 깨짐
  - 링크가 `[Bun SQLite] (/docs/connect-bun-sqlite)`처럼 비정상 공백 포함 형태로 바뀜
- `src/content/docs-ko/column-types/mysql.mdx`
  - 자연스러운 한국어가 아니라 기계적으로 손상된 문장 다수
- `src/content/docs-ko/arktype.mdx`
  - 서두에 `카지노사이트` 삽입
  - 보호 토큰이 복구되지 않아 파싱 실패

## 자동 검증 산출물

- 전체 로그: `translation/verify-report.txt`
- 사용한 검증 스크립트: `scripts/verify-docs.mjs`

## 판정

현재 번역 코퍼스는 완전성, 문법 유효성, 구조 보존, 용어 보존, 한국어 품질 어느 항목에서도 통과 판정을 줄 수 없다. 전체 재생성이 필요하다.
