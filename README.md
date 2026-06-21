# 債務記錄網頁

前後端分離的債務記錄工具，使用 React + Vite + shadcn 風格 UI 搭配 Express + SQLite。

這個專案適合用來記錄「誰欠誰、欠多少、還了多少」，並提供最簡易的結算建議，直接看出誰要還多少錢給誰。

## 專案特色

- 前端：React + Vite + shadcn 風格 UI
- 後端：Express + SQLite
- 資料庫：SQLite 本機檔案
- 功能：新增、編輯、刪除、搜尋、還款、結算建議

## GitHub 介紹

Repository: https://github.com/GodwhiteTaiwan/homework

GitHub Pages workflow: [.github/workflows/deploy-web.yml](.github/workflows/deploy-web.yml)

## 功能

- 可記錄誰欠誰、金額與備註
- 可將債務標記為已結清
- 可用姓名選單快速選取債務人與債權人
- 可搜尋債務人、債權人或備註
- 可編輯與刪除既有紀錄
- 可直接輸入還款金額，做最簡易部分還款
- 可查看總筆數、未結清金額、已結清金額
- 可在結算區直接看出「誰要還多少錢給誰」

## 開發

1. 安裝依賴：`npm install`
2. 啟動開發：`npm run dev`

## Frontend Build / GitHub Pages

- 前端 build：`npm run build --workspace @homework/web`
- 產物輸出：`apps/web/dist`
- GitHub Pages 會部署這個靜態資料夾
- 因為這個專案前端仍需要 API，GitHub Pages 上要另外設定 `VITE_API_BASE_URL` 指向後端服務網址

## 結構

- `apps/web`：前端
- `apps/api`：API 與 SQLite