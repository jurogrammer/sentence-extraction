# 검증 및 자막 업로드 기능 구현

## TL;DR

> **Quick Summary**: Electron 앱의 핵심 기능(OpenAI 연동, YouTube 다운로드, 파일 업로드)을 E2E 테스트로 검증하고, 누락된 자막 파일 업로드 기능과 OpenAI API 검증 UI를 구현합니다.
> 
> **Deliverables**:
> - Playwright E2E 테스트 인프라 및 4개 테스트 케이스
> - 자막 파일 업로드 기능 (SRT, VTT, ASS/SSA 지원)
> - 자막 우선순위: 사용자 업로드 > 내장 자막 > Whisper 전사
> - **OpenAI API 키 검증 UI (n8n 스타일)** - 입력 시 실시간 검증 + 상태 표시
> - **모델 선택 드롭다운** - API에서 사용 가능한 모델 목록 조회
> 
> **Estimated Effort**: Medium-Large (4-5 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: E2E 인프라 → OpenAI/YouTube/파일 테스트 → 자막 기능 구현 → 자막 테스트

---

## Context

### Original Request
1. OpenAI 모델 정상 연동 검증 (API 키 제공됨)
2. YouTube 다운로드 정상 동작 검증 (테스트 URL 제공됨)
3. 파일 업로드 정상 동작 검증 (테스트 파일 제공됨)
4. 누락 기능: 자막 파일 업로드 (자막 없는 경우에만 자동 생성)

### Interview Summary
**Key Discussions**:
- 검증 방식: 자동화 E2E 테스트 (Playwright)
- 자막 형식: SRT, VTT, ASS/SSA 모두 지원
- 자막 UI: 비디오 선택 시 자막도 함께 선택하는 통합 UI
- E2E 범위: 핵심 플로우 happy path만

**Research Findings**:
- OpenAI 사용처: `ai-openai.ts` (GPT 문장 선택), `whisper-cloud.ts` (Whisper 전사)
- 비디오 처리: URL → yt-dlp 다운로드, 파일 → temp 복사
- 자막 처리: 현재 SRT/VTT만 지원, 자막 업로드 기능 없음
- TypeScript: `tsc --noEmit` 통과 (에러 없음)

### Metis Review
**Identified Gaps** (addressed):
- E2E 테스트 타임아웃: 파이프라인 전체 5분으로 설정
- Electron 테스트 방식: 빌드 후 `./out/main/index.js` 실행
- 자막 우선순위: 사용자 제공 > 내장 > Whisper 명시
- ASS 파서: `ass-parser` 라이브러리 사용
- 테스트 데이터: 사용자 제공 URL/파일 활용

---

## Work Objectives

### Core Objective
앱의 핵심 기능이 정상 동작하는지 자동화된 E2E 테스트로 검증하고, 누락된 자막 업로드 기능을 구현합니다.

### Concrete Deliverables
- `tests/e2e/` 디렉토리에 Playwright 테스트 파일들
- `playwright.config.ts` 설정 파일
- 수정된 `PipelineOptions` 타입 (subtitlePath 추가)
- 수정된 `FileUpload.tsx` (자막 선택 UI 추가)
- 수정된 `MainPage.tsx` (자막 상태 관리)
- 수정된 `subtitle-extract.ts` (ASS 파서 추가)
- 수정된 `pipeline.ts` (사용자 자막 우선 사용 로직)
- **새 컴포넌트 `ApiKeyInput.tsx`** - API 키 검증 상태 표시 UI
- **수정된 `SettingsPage.tsx`** - 모델 선택 드롭다운으로 변경
- **새 IPC 핸들러** - OpenAI API 검증 및 모델 목록 조회

### Definition of Done
- [ ] `npm run build && npx playwright test` → 모든 테스트 통과
- [ ] OpenAI API로 문장 선택 테스트 통과 (cardCount > 0)
- [ ] YouTube URL 다운로드 테스트 통과
- [ ] 로컬 파일 업로드 테스트 통과
- [ ] 자막 파일 업로드 테스트 통과 (SRT, VTT, ASS)

### Must Have
- E2E 테스트 인프라 (Playwright + Electron)
- 4개 핵심 테스트 (OpenAI, YouTube, 파일, 자막)
- 자막 파일 선택 UI
- SRT, VTT, ASS 파싱 지원
- 자막 우선순위 로직
- **OpenAI API 키 실시간 검증** (입력 시 유효성 확인)
- **검증 상태 UI 표시** (체크마크/X 아이콘, 로딩 스피너)
- **모델 목록 조회 API** (OpenAI /v1/models 호출)
- **모델 선택 드롭다운** (텍스트 입력 → select box)

### Must NOT Have (Guardrails)
- 유닛 테스트 (E2E happy path만)
- CI/CD 파이프라인 설정
- 에러 케이스/엣지 케이스 테스트
- 자막 미리보기/편집 UI
- 자막 타이밍 조정 기능
- 드래그앤드롭 업로드
- UTF-8 외 인코딩 지원
- API 모킹 인프라

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (새로 구축)
- **User wants tests**: E2E 자동화 테스트
- **Framework**: Playwright with Electron

### E2E Test Approach

**Test Structure:**
- `tests/e2e/pipeline.spec.ts`: 파이프라인 통합 테스트
- 각 테스트는 실제 앱 빌드 후 실행
- 타임아웃: 5분 (파이프라인 전체 실행 시간)

**Acceptance Verification:**
```bash
# 테스트 실행
npm run build && npx playwright test

# 결과 확인
# Assert: All tests pass
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: E2E 인프라 구축 (Playwright 설정)
├── Task 4: 자막 파서 확장 (ASS 지원)
└── Task 7: OpenAI API 검증 IPC 추가

Wave 2 (After Wave 1):
├── Task 2: 타입 & IPC 확장 (subtitlePath)
├── Task 5: 자막 업로드 UI 구현
└── Task 8: OpenAI API 검증 UI 구현 (n8n 스타일)

Wave 3 (After Wave 2):
└── Task 3: 파이프라인 로직 수정 (자막 우선순위)

Wave 4 (After Wave 3):
└── Task 6: E2E 테스트 작성 및 실행

Critical Path: Task 1 → Task 6
New Path: Task 7 → Task 8 → Task 6
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 6 | 4, 7 |
| 2 | None | 3, 5 | 1, 4, 7 |
| 3 | 2 | 6 | 8 |
| 4 | None | 5 | 1, 2, 7 |
| 5 | 2, 4 | 6 | 3, 8 |
| 6 | 1, 3, 5, 8 | None | None (final) |
| 7 | None | 8 | 1, 2, 4 |
| 8 | 7 | 6 | 3, 5 |

---

## TODOs

- [x] 1. E2E 테스트 인프라 구축

  **What to do**:
  - Playwright 및 @playwright/test 설치
  - Electron 테스트용 playwright.config.ts 작성
  - tests/e2e/ 디렉토리 구조 생성
  - 테스트 헬퍼 유틸리티 작성 (앱 실행, 창 대기 등)

  **Must NOT do**:
  - CI/CD 설정 추가
  - 복잡한 픽스처/모킹 시스템 구축
  - 테스트 리포터 커스터마이징

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 설정 파일 작성과 패키지 설치는 단순 작업
  - **Skills**: [`playwright`]
    - `playwright`: Electron E2E 테스트 설정에 필수

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `package.json` - devDependencies 추가 위치

  **External References**:
  - Playwright Electron 공식 문서: https://playwright.dev/docs/api/class-electron

  **Acceptance Criteria**:

  ```bash
  # 설치 확인
  npx playwright --version
  # Assert: 버전 출력

  # 설정 파일 확인
  cat playwright.config.ts
  # Assert: electronApp 설정 포함

  # 테스트 디렉토리 확인
  ls tests/e2e/
  # Assert: 디렉토리 존재
  ```

  **Commit**: YES
  - Message: `test(e2e): add Playwright infrastructure for Electron testing`
  - Files: `package.json`, `playwright.config.ts`, `tests/e2e/`

---

- [ ] 2. 타입 & IPC 확장 (subtitlePath 추가)

  **What to do**:
  - `PipelineOptions` 인터페이스에 `subtitlePath?: string` 필드 추가
  - `ElectronAPI.dialog`에 자막 파일 선택 메서드 추가
  - IPC 핸들러에 자막 파일 다이얼로그 핸들러 추가
  - preload.ts에 자막 다이얼로그 API 노출

  **Must NOT do**:
  - 복잡한 파일 검증 로직 추가
  - 다중 파일 선택 지원

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 타입 정의와 IPC 핸들러는 기존 패턴 따라 작성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1, 4)
  - **Blocks**: Task 3, 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/shared/types.ts:13-17` - PipelineOptions 현재 구조
  - `src/shared/types.ts:61-64` - dialog API 패턴
  - `src/main/ipc-handlers.ts:21-29` - DIALOG_OPEN_FILE 핸들러 패턴
  - `src/preload/index.ts` - contextBridge API 노출 패턴

  **API/Type References**:
  - `src/shared/constants.ts` - IPC 채널 상수 정의 위치

  **Acceptance Criteria**:

  ```bash
  # 타입 확인
  grep -n "subtitlePath" src/shared/types.ts
  # Assert: subtitlePath?: string 존재

  # IPC 상수 확인
  grep -n "DIALOG_OPEN_SUBTITLE" src/shared/constants.ts
  # Assert: 자막 다이얼로그 상수 존재

  # TypeScript 컴파일
  npx tsc --noEmit
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(types): add subtitlePath to PipelineOptions and dialog API`
  - Files: `src/shared/types.ts`, `src/shared/constants.ts`, `src/main/ipc-handlers.ts`, `src/preload/index.ts`

---

- [ ] 3. 파이프라인 자막 우선순위 로직 수정

  **What to do**:
  - `pipeline.ts`에서 사용자 제공 자막 파일 우선 사용 로직 추가
  - 우선순위: 사용자 업로드 > 내장 자막 (yt-dlp) > Whisper 전사
  - 사용자 자막 있으면 temp 디렉토리로 복사 후 파싱
  - 로그에 어떤 자막 소스 사용했는지 기록

  **Must NOT do**:
  - 자막 검증/미리보기 로직 추가
  - 자막 품질 비교 로직 추가

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 기존 로직에 조건문 추가만 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/main/services/pipeline.ts:57-68` - 현재 자막 처리 로직 (subtitlePath 체크 → Whisper fallback)
  - `src/main/services/pipeline.ts:42-53` - 비디오 소스별 분기 패턴
  - `src/main/utils/logger.ts` - 로깅 패턴

  **API/Type References**:
  - `src/shared/types.ts:PipelineOptions` - 옵션 인터페이스
  - `src/main/services/subtitle-extract.ts:parseSubtitleFile` - 자막 파싱 함수

  **Acceptance Criteria**:

  ```bash
  # 로직 확인
  grep -A5 "options.subtitlePath" src/main/services/pipeline.ts
  # Assert: 사용자 자막 우선 체크 로직 존재

  # TypeScript 컴파일
  npx tsc --noEmit
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(pipeline): prioritize user-provided subtitle over embedded and whisper`
  - Files: `src/main/services/pipeline.ts`

---

- [x] 4. ASS/SSA 자막 파서 추가

  **What to do**:
  - `ass-parser` 또는 `ass-compiler` 패키지 설치 (타입 지원 확인)
  - `subtitle-extract.ts`에 ASS/SSA 파싱 함수 추가
  - `parseSubtitleFile()`에 .ass/.ssa 확장자 분기 추가
  - ASS 스타일 태그 제거 로직 추가 ({\pos}, {\an} 등)

  **Must NOT do**:
  - 스타일 정보 보존/적용
  - 복잡한 ASS 기능 지원 (카라오케, 이펙트)
  - 다른 자막 형식 추가 (.sub, .sbv 등)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 라이브러리 설치와 파서 함수 추가만 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/main/services/subtitle-extract.ts:5-12` - parseSubtitleFile 확장자 분기 패턴
  - `src/main/services/subtitle-extract.ts:41-47` - stripTags 함수 (HTML/브라켓 태그 제거)
  - `src/main/services/subtitle-extract.ts:50-60` - mergeDuplicates 함수

  **External References**:
  - npm ass-parser: https://www.npmjs.com/package/ass-parser
  - ASS 형식 스펙: https://en.wikipedia.org/wiki/SubStation_Alpha

  **Acceptance Criteria**:

  ```bash
  # 패키지 설치 확인
  grep "ass-parser\|ass-compiler" package.json
  # Assert: 패키지 존재

  # ASS 파서 확인
  grep -n "\.ass\|\.ssa" src/main/services/subtitle-extract.ts
  # Assert: 확장자 체크 로직 존재

  # TypeScript 컴파일
  npx tsc --noEmit
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(subtitle): add ASS/SSA format parser support`
  - Files: `package.json`, `src/main/services/subtitle-extract.ts`

---

- [ ] 5. 자막 업로드 UI 구현

  **What to do**:
  - `FileUpload.tsx` 수정: 자막 파일 선택 버튼 추가
  - `MainPage.tsx`에 subtitlePath 상태 추가
  - handleStart에서 subtitlePath를 PipelineOptions에 포함
  - i18n에 자막 관련 번역 추가
  - 자막 파일 필터: .srt, .vtt, .ass, .ssa

  **Must NOT do**:
  - 드래그앤드롭 구현
  - 자막 미리보기 UI
  - 복잡한 파일 검증

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI 컴포넌트 수정이 핵심
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React 컴포넌트 UI 패턴

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2, 4

  **References**:

  **Pattern References**:
  - `src/renderer/components/FileUpload.tsx` - 전체 파일 (기존 파일 업로드 컴포넌트)
  - `src/renderer/pages/MainPage.tsx:11-12` - 상태 관리 패턴 (useState)
  - `src/renderer/pages/MainPage.tsx:16-22` - handleStart 함수
  - `src/renderer/i18n/index.ts` - i18n 번역 파일 위치

  **API/Type References**:
  - `src/shared/types.ts:PipelineOptions` - start 함수 인자 타입
  - `src/shared/types.ts:ElectronAPI.dialog` - 다이얼로그 API

  **Acceptance Criteria**:

  **Frontend UI 검증 (Playwright)**:
  ```
  # Agent executes via playwright browser automation:
  1. Build app: npm run build
  2. Launch Electron: _electron.launch({ args: ['./out/main/index.js'] })
  3. Wait for window
  4. Assert: 자막 선택 버튼 visible (text contains "자막" or "subtitle")
  5. Click: 자막 선택 버튼
  6. Assert: 파일 다이얼로그 열림 (mock 또는 cancel로 확인)
  ```

  **Commit**: YES
  - Message: `feat(ui): add subtitle file selection in FileUpload component`
  - Files: `src/renderer/components/FileUpload.tsx`, `src/renderer/pages/MainPage.tsx`, `src/renderer/i18n/index.ts`

---

- [x] 7. OpenAI API 검증 IPC 추가

  **What to do**:
  - IPC 핸들러 `OPENAI_VALIDATE_KEY`: API 키로 /v1/models 호출하여 유효성 확인
  - IPC 핸들러 `OPENAI_LIST_MODELS`: 사용 가능한 GPT 모델 목록 반환
  - preload.ts에 새 API 노출 (`window.api.openai.validateKey`, `window.api.openai.listModels`)
  - 타입 정의 추가 (ElectronAPI에 openai 섹션)
  - 에러 처리: 잘못된 키 → false 반환, 네트워크 에러 → 에러 메시지

  **Must NOT do**:
  - 복잡한 캐싱 로직
  - 전체 모델 목록 (GPT 모델만 필터링)
  - 레이트 리미팅 처리

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: IPC 핸들러 패턴 따라 단순 구현
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1, 4)
  - **Blocks**: Task 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/main/ipc-handlers.ts:21-29` - DIALOG_OPEN_FILE 핸들러 패턴
  - `src/main/services/ai-openai.ts:15-20` - OpenAI 클라이언트 생성 패턴
  - `src/preload/index.ts` - contextBridge API 노출 패턴

  **API/Type References**:
  - `src/shared/types.ts:ElectronAPI` - API 타입 정의 위치
  - `src/shared/constants.ts:IPC` - IPC 채널 상수

  **External References**:
  - OpenAI Models API: https://platform.openai.com/docs/api-reference/models/list

  **Acceptance Criteria**:

  ```bash
  # IPC 상수 확인
  grep -n "OPENAI_VALIDATE\|OPENAI_LIST" src/shared/constants.ts
  # Assert: 두 상수 존재

  # 핸들러 확인
  grep -n "OPENAI_VALIDATE\|OPENAI_LIST" src/main/ipc-handlers.ts
  # Assert: 핸들러 등록됨

  # 타입 확인
  grep -n "openai:" src/shared/types.ts
  # Assert: ElectronAPI에 openai 섹션 존재

  # TypeScript 컴파일
  npx tsc --noEmit
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(ipc): add OpenAI API key validation and model listing handlers`
  - Files: `src/shared/constants.ts`, `src/shared/types.ts`, `src/main/ipc-handlers.ts`, `src/preload/index.ts`

---

- [ ] 8. OpenAI API 검증 UI 구현 (n8n 스타일)

  **What to do**:
  - 새 컴포넌트 `ApiKeyInput.tsx`: 패스워드 입력 + 검증 상태 표시
    - 입력 필드 우측에 상태 아이콘 (로딩 스피너 / 체크마크 / X)
    - 디바운스 적용 (입력 후 500ms 대기 후 검증)
    - 검증 성공 시 초록색 체크, 실패 시 빨간색 X + 에러 메시지
  - 새 컴포넌트 `ModelSelect.tsx`: 모델 드롭다운
    - API 키 검증 성공 시 모델 목록 자동 로드
    - GPT 모델만 필터링 (gpt-4, gpt-3.5 등)
    - 로딩 중 disabled + 스피너 표시
  - `SettingsPage.tsx` 수정: 기존 Field 컴포넌트 → 새 컴포넌트로 교체

  **Must NOT do**:
  - 커스텀 드롭다운 UI (기본 select 사용)
  - 모델 상세 정보 표시
  - API 응답 캐싱

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI 컴포넌트 구현이 핵심
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React 상태 관리 + UI 피드백 패턴

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 7

  **References**:

  **Pattern References**:
  - `src/renderer/pages/SettingsPage.tsx:34-47` - 현재 OpenAI 설정 UI
  - `src/renderer/pages/SettingsPage.tsx:137-159` - Field 컴포넌트 패턴
  - `src/renderer/components/ProviderSelector.tsx` - 선택 UI 컴포넌트 패턴
  - `src/renderer/hooks/useSettings.ts` - 설정 관리 훅

  **UI/UX References**:
  - n8n 스타일: 입력 필드 우측에 검증 상태 아이콘
  - 상태: idle → validating (스피너) → valid (✓) / invalid (✗)
  - 색상: 초록(성공), 빨강(실패), 회색(대기)

  **Acceptance Criteria**:

  **Frontend UI 검증 (Playwright)**:
  ```
  # Agent executes via playwright browser automation:
  1. Build app: npm run build
  2. Launch Electron: _electron.launch({ args: ['./out/main/index.js'] })
  3. Navigate to Settings page
  4. Find API key input field
  5. Enter invalid key: "invalid-key"
  6. Wait 600ms (debounce + API call)
  7. Assert: 빨간색 X 아이콘 또는 에러 메시지 visible
  8. Clear and enter valid key (환경변수에서)
  9. Wait 600ms
  10. Assert: 초록색 체크마크 visible
  11. Assert: 모델 드롭다운 enabled
  12. Assert: 드롭다운에 gpt-4o-mini 등 옵션 존재
  ```

  **Commit**: YES
  - Message: `feat(ui): add OpenAI API key validation with status indicator and model dropdown`
  - Files: `src/renderer/components/ApiKeyInput.tsx`, `src/renderer/components/ModelSelect.tsx`, `src/renderer/pages/SettingsPage.tsx`

---

- [ ] 6. E2E 테스트 작성 및 실행

  **What to do**:
  - OpenAI 연동 테스트: API 키 설정 → 짧은 비디오로 파이프라인 실행 → cardCount > 0 확인
  - YouTube 다운로드 테스트: 테스트 URL로 다운로드 시작 → 진행률 표시 확인
  - 파일 업로드 테스트: 로컬 파일 선택 → 경로 표시 확인
  - 자막 업로드 테스트: 자막 파일 선택 → 경로 표시 및 파이프라인에서 사용 확인

  **Must NOT do**:
  - 에러 케이스 테스트
  - 취소 기능 테스트
  - API 모킹
  - 유닛 테스트 작성

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: E2E 테스트 작성은 통합 이해 필요
  - **Skills**: [`playwright`]
    - `playwright`: Electron E2E 테스트 작성

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None
  - **Blocked By**: Task 1, 3, 5

  **References**:

  **Pattern References**:
  - `playwright.config.ts` (Task 1에서 생성) - 테스트 설정
  - `src/renderer/pages/MainPage.tsx` - 테스트할 UI 요소들
  - `src/renderer/pages/SettingsPage.tsx` - API 키 설정 UI

  **Test Data**:
  - OpenAI API Key: 사용자 제공 (테스트 시 환경변수 또는 직접 입력)
  - YouTube URL: `https://www.youtube.com/watch?v=glFrp-CmNVA&list=PLdVY0007sCPWPFaTE-Y2UVZiDc0iGkYLT`
  - Local File: `/Users/user/Downloads/getvid.mp4`
  - 자막 테스트 파일: 테스트 내에서 샘플 생성 또는 제공 필요

  **External References**:
  - Playwright Electron API: https://playwright.dev/docs/api/class-electron

  **Acceptance Criteria**:

  ```bash
  # 앱 빌드
  npm run build
  # Assert: Exit code 0

  # E2E 테스트 실행
  OPENAI_API_KEY="..." npx playwright test tests/e2e/
  # Assert: All tests pass

  # 개별 테스트 확인
  npx playwright test tests/e2e/pipeline.spec.ts --grep "OpenAI"
  # Assert: OpenAI 테스트 통과

  npx playwright test tests/e2e/pipeline.spec.ts --grep "YouTube"
  # Assert: YouTube 테스트 통과

  npx playwright test tests/e2e/pipeline.spec.ts --grep "file upload"
  # Assert: 파일 업로드 테스트 통과

  npx playwright test tests/e2e/pipeline.spec.ts --grep "subtitle"
  # Assert: 자막 업로드 테스트 통과
  ```

  **Evidence to Capture:**
  - [ ] Playwright 테스트 결과 출력
  - [ ] 스크린샷 (필요시 .sisyphus/evidence/)

  **Commit**: YES
  - Message: `test(e2e): add pipeline E2E tests for OpenAI, YouTube, file, and subtitle upload`
  - Files: `tests/e2e/pipeline.spec.ts`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `test(e2e): add Playwright infrastructure` | package.json, playwright.config.ts, tests/e2e/ | npx playwright --version |
| 2 | `feat(types): add subtitlePath to PipelineOptions` | types.ts, constants.ts, ipc-handlers.ts, preload.ts | npx tsc --noEmit |
| 3 | `feat(pipeline): prioritize user subtitle` | pipeline.ts | npx tsc --noEmit |
| 4 | `feat(subtitle): add ASS/SSA parser` | package.json, subtitle-extract.ts | npx tsc --noEmit |
| 5 | `feat(ui): add subtitle file selection` | FileUpload.tsx, MainPage.tsx, i18n/index.ts | npm run build |
| 6 | `test(e2e): add pipeline E2E tests` | tests/e2e/pipeline.spec.ts | npx playwright test |
| 7 | `feat(ipc): add OpenAI API validation handlers` | constants.ts, types.ts, ipc-handlers.ts, preload.ts | npx tsc --noEmit |
| 8 | `feat(ui): add API key validation and model dropdown` | ApiKeyInput.tsx, ModelSelect.tsx, SettingsPage.tsx | npm run build |

---

## Success Criteria

### Verification Commands
```bash
# 전체 빌드
npm run build
# Expected: Exit code 0

# TypeScript 검사
npx tsc --noEmit
# Expected: Exit code 0

# E2E 테스트 실행
OPENAI_API_KEY="sk-..." npx playwright test
# Expected: All tests pass (4/4)
```

### Final Checklist
- [ ] E2E 테스트 인프라 구축 완료
- [ ] OpenAI 연동 테스트 통과
- [ ] YouTube 다운로드 테스트 통과
- [ ] 파일 업로드 테스트 통과
- [ ] 자막 업로드 기능 구현 완료
- [ ] SRT, VTT, ASS 형식 모두 파싱 가능
- [ ] 자막 우선순위 로직 적용됨
- [ ] **OpenAI API 키 실시간 검증 UI 동작**
- [ ] **모델 선택 드롭다운 동작**
- [ ] 모든 테스트 통과
