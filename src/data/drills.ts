// Practice positions played against Stockfish at full strength. Every position was
// checked with Stockfish 19 (depth 24): wins evaluate as winning and draws as about 0.00.

export type DrillGoal = 'mate' | 'win' | 'draw';

export interface Drill {
  id: string;
  group: string;
  title: string;
  fen: string;
  goal: DrillGoal;
  /** Mate/win: moves for three stars. Draw: moves to survive. */
  par: number;
  desc: string;
  hint: string;
}

export const DRILLS: Drill[] = [
  {
    id: 'mate-queen',
    group: 'Chiếu hết cơ bản',
    title: 'Hậu + Vua chiếu hết',
    fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    goal: 'mate',
    par: 8,
    desc: 'Dùng Hậu thu hẹp vùng di chuyển của Vua đen, rồi đưa Vua trắng lại gần để chiếu hết.',
    hint: 'Đặt Hậu cách Vua đen một nước Mã để ép nó ra mép bàn. Cẩn thận đừng để hết nước đi (hòa)!',
  },
  {
    id: 'mate-two-rooks',
    group: 'Chiếu hết cơ bản',
    title: 'Hai Xe (bậc thang)',
    fen: '8/8/8/3k4/8/8/8/RR4K1 w - - 0 1',
    goal: 'mate',
    par: 7,
    desc: 'Hai Xe thay nhau chiếu theo hàng, đẩy Vua đen về hàng cuối như bước xuống cầu thang.',
    hint: 'Một Xe chặn một hàng, Xe kia chiếu ở hàng kế tiếp. Khi Vua đen tiến lại gần Xe, đưa Xe sang cánh xa.',
  },
  {
    id: 'mate-rook',
    group: 'Chiếu hết cơ bản',
    title: 'Xe + Vua chiếu hết',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    goal: 'mate',
    par: 16,
    desc: 'Xe cắt Vua đen theo hàng hoặc cột, Vua trắng tiến lên tạo thế đối vương để Xe chiếu.',
    hint: 'Khi hai Vua đối diện nhau (cách một ô), Xe chiếu dọc theo mép để đẩy Vua đen lùi một hàng.',
  },
  {
    id: 'mate-two-bishops',
    group: 'Chiếu hết cơ bản',
    title: 'Hai Tượng chiếu hết',
    fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1',
    goal: 'mate',
    par: 20,
    desc: 'Hai Tượng đứng cạnh nhau tạo "bức tường" chéo, cùng Vua dồn Vua đen vào góc.',
    hint: 'Giữ hai Tượng cạnh nhau ở giữa bàn; Vua trắng hỗ trợ. Chiếu hết chỉ xảy ra ở góc bàn.',
  },
  {
    id: 'pawn-opposition',
    group: 'Tàn cuộc Tốt',
    title: 'Đối vương: thắng với Tốt',
    fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
    goal: 'win',
    par: 14,
    desc: 'Vua trắng đi trước Tốt hai hàng. Hãy giành thế đối vương và phong cấp.',
    hint: 'Nước đầu: dùng Tốt đi một ô (e3) để chuyển lượt đi và giành thế đối vương.',
  },
  {
    id: 'pawn-defend',
    group: 'Tàn cuộc Tốt',
    title: 'Phòng thủ: giữ đối vương',
    fen: '8/8/4k3/8/4PK2/8/8/8 b - - 0 1',
    goal: 'draw',
    par: 12,
    desc: 'Bạn cầm Đen. Giữ Vua đối diện Vua trắng để chặn Tốt và cầm hòa.',
    hint: 'Đi Vua sao cho hai Vua đứng đối diện với một ô ở giữa, ngay sau khi Trắng đi Vua.',
  },
  {
    id: 'pawn-square',
    group: 'Tàn cuộc Tốt',
    title: 'Quy tắc hình vuông',
    fen: '7k/8/8/p7/8/8/8/5K2 w - - 0 1',
    goal: 'draw',
    par: 8,
    desc: 'Tốt đen đang chạy về phong cấp. Vua trắng có kịp đuổi theo không?',
    hint: 'Vẽ hình vuông từ Tốt đến hàng phong cấp. Vua bước vào hình vuông là bắt kịp Tốt.',
  },
  {
    id: 'rook-lucena',
    group: 'Tàn cuộc Xe',
    title: 'Thế Lucena (bắc cầu)',
    fen: '1K6/1P2k3/8/8/8/8/r7/3R4 w - - 0 1',
    goal: 'win',
    par: 20,
    desc: 'Vua trắng bị kẹt trước Tốt. Dùng Xe "bắc cầu" để che chiếu và phong cấp.',
    hint: 'Đưa Xe lên hàng 4 (Rd4) trước, sau đó đưa Vua ra khỏi ô b8 và dùng Xe chặn các nước chiếu.',
  },
  {
    id: 'rook-philidor',
    group: 'Tàn cuộc Xe',
    title: 'Thế Philidor (phòng thủ)',
    fen: '4k3/R7/7r/3KP3/8/8/8/8 b - - 0 1',
    goal: 'draw',
    par: 15,
    desc: 'Bạn cầm Đen. Giữ Xe ở hàng 6 để Vua trắng không tiến lên được.',
    hint: 'Xe đen ở lại hàng 6. Khi Tốt trắng tiến lên e6, chuyển Xe xuống hàng 1 và chiếu từ phía sau.',
  },
  {
    id: 'queen-vs-pawn',
    group: 'Tàn cuộc Hậu',
    title: 'Hậu đấu Tốt ở hàng 7',
    fen: 'K7/8/8/8/8/8/3pk3/7Q w - - 0 1',
    goal: 'win',
    par: 20,
    desc: 'Tốt đen sắp phong cấp. Dùng chuỗi chiếu để buộc Vua đen đứng trước Tốt, rồi đưa Vua trắng lại gần.',
    hint: 'Chiếu hoặc ghim để Vua đen phải chặn ô phong cấp (d1); mỗi lần như vậy Vua trắng tiến một bước.',
  },
];

export function starsFor(drill: Drill, moves: number): number {
  if (drill.goal === 'draw') return 3;
  if (moves <= drill.par) return 3;
  if (moves <= Math.ceil(drill.par * 1.5)) return 2;
  return 1;
}
