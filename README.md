# Cờ Vua Luyện Tập

Ứng dụng web luyện cờ vua, lấy cảm hứng từ Chess.com. Phần luyện tập chạy hoàn toàn trên trình duyệt; chế độ chơi online dùng một Cloudflare Worker.

**Chơi ngay:** https://haodhh.github.io/Chess/

## Tính năng

**Puzzle**
- **Puzzle tính điểm:** chọn quanh rating của bạn (Glicko-2), 3 mức độ khó, gợi ý, xem lời giải, xem lại từng nước.
- **Theo chủ đề:** hơn 60 chủ đề (chĩa đôi, ghim, các mẫu chiếu hết, tàn cuộc…) kèm tỉ lệ đúng của bạn.
- **Puzzle Rush** (3 phút / 5 phút / Sống sót), **Puzzle hằng ngày**.
- **Ôn lỗi:** puzzle giải sai và lỗi trong ván của bạn được hẹn lịch ôn bằng FSRS.

**Luyện tập** (Stockfish 19 chạy ngay trong trình duyệt)
- **Chơi với máy:** 7 mức từ ~400 tới Stockfish tối đa, có gợi ý và đi lại; ván đang chơi dở được lưu để chơi tiếp.
- **Phân tích ván:** các ván đã chơi (hoặc dán PGN); phân loại từng nước (tốt nhất → sai nghiêm trọng), độ chính xác, biểu đồ đánh giá, thử lại nước sai và đưa vào Ôn lỗi.
- **Drills:** 10 thế chiếu hết và tàn cuộc kinh điển (Lucena, Philidor, đối vương…) chơi với Stockfish.
- **Luyện tọa độ** và **bàn phân tích** tự do.

**Học**
- **17 bài học tương tác** (Nền tảng, Chiến thuật, Tàn cuộc): giải thích, tự đi quân, trắc nghiệm, puzzle theo chủ đề.
- **Cây khai cuộc** với 3.815 biến có tên, và **Repertoire**: luyện thuộc các biến bạn chọn.

**Chơi online (PvP)**
- Tạo phòng (tên, mật khẩu tùy chọn, màu quân, thời gian 3+2 … 30+0 hoặc không giới hạn), gửi mã phòng/link cho bạn bè.
- Danh sách phòng đang chờ (🔒 nếu có mật khẩu), vào phòng bằng mã.
- Máy chủ kiểm tra nước đi và chạy đồng hồ; có cầu hòa, xin thua, chơi lại (đổi màu), vào lại ván khi rớt mạng, nhận thắng khi đối thủ rời quá 60 giây. Ván xong được lưu để phân tích.

**Khác:** thống kê, mục tiêu hằng ngày, chuỗi ngày, 4 màu bàn cờ, sao lưu/khôi phục, cài lên màn hình chính điện thoại.

Kế hoạch tổng thể: [docs/PLAN.md](docs/PLAN.md).

## Lưu dữ liệu

- **Trong trình duyệt (mặc định):** mọi tiến độ được tự động lưu vào IndexedDB sau mỗi thao tác.
- **Online (tùy chọn):** vào **Cài đặt → Lưu online**, tạo một token GitHub chỉ có quyền `gist` và dán vào. Ứng dụng lưu một bản sao vào một Gist bí mật trong tài khoản của bạn và tự đồng bộ khi có thay đổi. Mở trang trên máy khác, kết nối cùng tài khoản là chơi tiếp được. Dữ liệu từ hai máy được gộp (không ghi đè mất tiến độ); bản ghi đã xóa không bị khôi phục lại. Token chỉ nằm trong trình duyệt, không có trong Gist hay file sao lưu.
- **File sao lưu:** **Cài đặt → Sao lưu / Khôi phục** (JSON).

## Phát triển

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit test (Vitest)
npm run build    # bản build tĩnh trong dist/
```

Công nghệ: React + TypeScript + Vite, Tailwind CSS, [chessground](https://github.com/lichess-org/chessground) (bàn cờ của Lichess), chess.js, [Stockfish.js](https://github.com/nmrugg/stockfish.js) (bản lite, `public/engine/`), Dexie (IndexedDB), ts-fsrs.

## Dữ liệu puzzle

`public/data/puzzles/` chứa khoảng 60.000 puzzle lấy mẫu từ [kho puzzle của Lichess](https://database.lichess.org/#puzzles) (CC0), chia theo mức rating 100 điểm. Để tạo lại dữ liệu, chạy workflow **Build puzzle data** trong tab Actions, hoặc chạy trên máy:

```bash
curl -L https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | npm run build:puzzles
```

Tên khai cuộc (`public/data/openings.json`) lấy từ [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings); tạo lại bằng `npm run build:openings`.

## Deploy

**Cloudflare (đầy đủ, gồm chơi online):** `wrangler.jsonc` mô tả một Worker phục vụ thư mục `dist/` và máy chủ phòng chơi (Durable Objects `ChessRoom`, `Lobby`, trong `worker/`). Với Cloudflare Workers nối GitHub, mỗi lần push Cloudflare chạy `npx wrangler deploy` (lệnh này tự chạy `npm run build` trước). Tên Worker trong `wrangler.jsonc` (`chess`) phải trùng tên Worker trên Cloudflare. Chạy thử trên máy: `npm run dev:worker` (http://localhost:8787).

**GitHub Pages (không có chơi online):** workflow **Build and deploy** chạy test, build và deploy mỗi khi push lên nhánh mặc định. Cần bật một lần: **Settings → Pages → Source: GitHub Actions**. Muốn bản GitHub Pages dùng máy chủ Cloudflare, đặt biến `VITE_PVP_SERVER` (ví dụ `https://chess.<tài-khoản>.workers.dev`) khi build.

## Giấy phép

GPL-3.0-or-later (vì dùng chessground và Stockfish, đều theo GPL-3.0). Dữ liệu puzzle và tên khai cuộc: CC0, nguồn Lichess.
