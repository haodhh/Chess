import { Link } from 'react-router';

const CONTENT = {
  train: {
    title: '🏋️ Luyện tập',
    items: [
      'Vision: luyện nhận diện tọa độ ô và ký hiệu nước đi',
      'Chơi với máy (Stockfish) ở nhiều mức độ, có gợi ý và đi lại',
      'Drills: chiếu hết cơ bản và tàn cuộc kinh điển (Lucena, Philidor…)',
      'Phân tích ván: nhập ván từ chess.com/Lichess, phân loại nước đi, thử lại chỗ sai',
    ],
  },
  learn: {
    title: '🎓 Học',
    items: [
      'Bài học tương tác: từ luật cơ bản đến chiến thuật và tàn cuộc',
      'Cây khai cuộc với tên gọi từng biến',
      'Luyện repertoire khai cuộc bằng lặp lại ngắt quãng',
    ],
  },
};

export function ComingSoon({ section }: { section: keyof typeof CONTENT }) {
  const c = CONTENT[section];
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-2xl font-extrabold">{c.title}</h1>
      <p className="mb-4 text-muted">Phần này đang được xây dựng. Dự kiến gồm:</p>
      <ul className="card mb-5 list-disc space-y-2 pl-8">
        {c.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <Link to="/puzzles" className="btn btn-primary">
        Trong lúc chờ, giải puzzle nhé →
      </Link>
    </div>
  );
}
