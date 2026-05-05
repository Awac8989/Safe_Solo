# SafeSolo Web App UI

Giao diện React/Vite mới đã được tích hợp từ repository `alive-beacon-system-773c2a3b`.

## Chạy nhanh

```bash
cd web-app
npm install --legacy-peer-deps
npm run dev
```

## Build

```bash
npm run build
```

## Môi trường

File `.env` hiện có chứa cấu hình Supabase. Nếu cần nối backend Node, bạn có thể thêm:

```env
VITE_BACKEND_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```
