# Cờ Vua Luyện Tập

Ứng dụng web luyện cờ vua, lấy cảm hứng từ Chess.com, chạy hoàn toàn trên trình duyệt và được host trên GitHub Pages.

**Chơi ngay:** https://haodhh.github.io/Chess/

## Đã có: Puzzle

- **Puzzle tính điểm:** puzzle được chọn quanh rating của bạn (Glicko-2), có 3 mức độ khó (Dễ / Vừa / Khó), gợi ý, xem lời giải và xem lại từng nước.
- **Theo chủ đề:** hơn 60 chủ đề (chĩa đôi, ghim, xiên, các mẫu chiếu hết, tàn cuộc…), kèm tỉ lệ đúng của bạn ở từng chủ đề.
- **Puzzle Rush:** 3 phút, 5 phút hoặc Sống sót; sai 3 lần là hết; lưu kỷ lục.
- **Ôn lỗi:** mọi puzzle giải sai được hẹn lịch ôn lại bằng thuật toán lặp lại ngắt quãng FSRS.
- **Puzzle hằng ngày**, **thống kê** (biểu đồ rating, chủ đề yếu nhất, lịch sử) và **cài đặt** (màu bàn cờ, âm thanh, sao lưu/khôi phục dữ liệu).

Tiến độ được lưu trong trình duyệt (IndexedDB). Dùng **Cài đặt → Sao lưu** để chuyển dữ liệu sang máy khác.

Phần **Luyện tập (Train)** và **Học (Learn)** sẽ làm tiếp theo [kế hoạch](docs/PLAN.md).

## Phát triển

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit test (Vitest)
npm run build    # bản build tĩnh trong dist/
```

Công nghệ: React + TypeScript + Vite, Tailwind CSS, [chessground](https://github.com/lichess-org/chessground) (bàn cờ của Lichess), chess.js, Dexie (IndexedDB), ts-fsrs.

## Dữ liệu puzzle

`public/data/puzzles/` chứa khoảng 60.000 puzzle lấy mẫu từ [kho puzzle của Lichess](https://database.lichess.org/#puzzles) (CC0), chia theo mức rating 100 điểm. Để tạo lại dữ liệu, chạy workflow **Build puzzle data** trong tab Actions, hoặc chạy trên máy:

```bash
curl -L https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | npm run build:puzzles
```

## Deploy

Workflow **Build and deploy** chạy test, build và deploy lên GitHub Pages mỗi khi push lên nhánh mặc định. Cần bật một lần: **Settings → Pages → Source: GitHub Actions**.

## Giấy phép

GPL-3.0-or-later (vì dùng chessground, cũng theo GPL-3.0). Dữ liệu puzzle: CC0, nguồn Lichess.
