// Vietnamese names and short explanations for the Lichess puzzle themes.

export interface ThemeInfo {
  name: string;
  desc?: string;
}

export const THEMES: Record<string, ThemeInfo> = {
  // Đòn chiến thuật
  fork: { name: 'Chĩa đôi', desc: 'Một quân tấn công cùng lúc hai hay nhiều quân đối phương.' },
  pin: { name: 'Ghim', desc: 'Quân bị tấn công không thể di chuyển vì sẽ để lộ quân giá trị hơn phía sau.' },
  skewer: { name: 'Xiên', desc: 'Tấn công một quân giá trị cao; khi nó tránh đi, quân phía sau bị ăn.' },
  discoveredAttack: { name: 'Tấn công mở', desc: 'Di chuyển một quân để mở đường tấn công cho quân phía sau.' },
  discoveredCheck: { name: 'Chiếu mở', desc: 'Di chuyển một quân để quân phía sau chiếu Vua.' },
  doubleCheck: { name: 'Chiếu đôi', desc: 'Chiếu bằng hai quân cùng lúc: Vua buộc phải chạy.' },
  sacrifice: { name: 'Thí quân', desc: 'Hy sinh vật chất để đổi lấy lợi thế lớn hơn.' },
  deflection: { name: 'Đánh lạc hướng', desc: 'Kéo quân phòng thủ ra khỏi nhiệm vụ của nó.' },
  attraction: { name: 'Dụ quân', desc: 'Buộc quân đối phương (thường là Vua) đến một ô bất lợi.' },
  clearance: { name: 'Giải phóng đường', desc: 'Dọn một ô hoặc đường đi cho quân khác tấn công.' },
  interference: { name: 'Chặn đường', desc: 'Đặt quân chen giữa để cắt liên lạc giữa các quân đối phương.' },
  intermezzo: { name: 'Nước trung gian', desc: 'Chen một nước bất ngờ thay vì đáp trả theo lẽ thường.' },
  xRayAttack: { name: 'Tấn công X-quang', desc: 'Quân tấn công hoặc bảo vệ một ô xuyên qua quân khác.' },
  capturingDefender: { name: 'Diệt quân phòng thủ', desc: 'Ăn quân đang bảo vệ một quân hoặc ô quan trọng.' },
  hangingPiece: { name: 'Quân không được bảo vệ', desc: 'Ăn một quân bị bỏ ngỏ, không ai bảo vệ.' },
  trappedPiece: { name: 'Bẫy quân', desc: 'Quân đối phương không còn ô an toàn để chạy.' },
  exposedKing: { name: 'Vua hở', desc: 'Tấn công một Vua thiếu quân che chắn.' },
  attackingF2F7: { name: 'Tấn công f2/f7', desc: 'Đánh vào ô yếu f2/f7 cạnh Vua chưa nhập thành.' },
  kingsideAttack: { name: 'Tấn công cánh Vua' },
  queensideAttack: { name: 'Tấn công cánh Hậu' },
  quietMove: { name: 'Nước êm', desc: 'Nước không chiếu, không ăn quân nhưng tạo đòn không thể chống đỡ.' },
  defensiveMove: { name: 'Nước phòng thủ', desc: 'Nước chính xác để tránh mất quân hoặc thua.' },
  zugzwang: { name: 'Zugzwang', desc: 'Đối phương buộc phải đi và mọi nước đi đều làm thế cờ xấu đi.' },
  advancedPawn: { name: 'Tốt tiến sâu', desc: 'Tốt đã tiến sâu vào trận địa đối phương, đe dọa phong cấp.' },
  promotion: { name: 'Phong cấp' },
  underPromotion: { name: 'Phong cấp thấp', desc: 'Phong thành Mã, Tượng hoặc Xe thay vì Hậu.' },
  enPassant: { name: 'Bắt tốt qua đường' },
  castling: { name: 'Nhập thành' },
  collinearMove: { name: 'Nước đi thẳng hàng' },

  // Chiếu hết
  mate: { name: 'Chiếu hết' },
  mateIn1: { name: 'Chiếu hết 1 nước' },
  mateIn2: { name: 'Chiếu hết 2 nước' },
  mateIn3: { name: 'Chiếu hết 3 nước' },
  mateIn4: { name: 'Chiếu hết 4 nước' },
  mateIn5: { name: 'Chiếu hết 5+ nước' },
  backRankMate: { name: 'Mate hàng cuối', desc: 'Vua bị kẹt ở hàng cuối bởi chính các Tốt của mình.' },
  smotheredMate: { name: 'Mate ngộp', desc: 'Mã chiếu hết Vua bị các quân của chính nó vây kín.' },
  anastasiaMate: { name: 'Mate Anastasia', desc: 'Mã và Xe (hoặc Hậu) bẫy Vua ở mép bàn.' },
  arabianMate: { name: 'Mate Ả Rập', desc: 'Mã và Xe phối hợp chiếu hết Vua ở góc bàn.' },
  bodenMate: { name: 'Mate Boden', desc: 'Hai Tượng chéo nhau chiếu hết Vua bị quân mình chặn.' },
  doubleBishopMate: { name: 'Mate hai Tượng' },
  dovetailMate: { name: 'Mate đuôi én', desc: 'Hậu chiếu hết sát Vua, hai ô thoát bị quân của chính nó chặn.' },
  hookMate: { name: 'Mate móc câu', desc: 'Xe, Mã và Tốt phối hợp chiếu hết.' },
  epauletteMate: { name: 'Mate cầu vai', desc: 'Vua bị hai quân của mình chặn hai bên.' },
  operaMate: { name: 'Mate Opera', desc: 'Xe chiếu hết ở hàng cuối với Tượng hỗ trợ.' },
  pillsburysMate: { name: 'Mate Pillsbury' },
  morphysMate: { name: 'Mate Morphy' },
  cornerMate: { name: 'Mate góc' },
  swallowstailMate: { name: 'Mate đuôi nhạn' },
  killBoxMate: { name: 'Mate hộp' },
  triangleMate: { name: 'Mate tam giác' },
  blindSwineMate: { name: 'Mate hai Xe hàng 7' },
  vukovicMate: { name: 'Mate Vuković' },
  balestraMate: { name: 'Mate Balestra' },

  // Giai đoạn
  opening: { name: 'Khai cuộc' },
  middlegame: { name: 'Trung cuộc' },
  endgame: { name: 'Tàn cuộc' },
  pawnEndgame: { name: 'Tàn cuộc Tốt' },
  rookEndgame: { name: 'Tàn cuộc Xe' },
  bishopEndgame: { name: 'Tàn cuộc Tượng' },
  knightEndgame: { name: 'Tàn cuộc Mã' },
  queenEndgame: { name: 'Tàn cuộc Hậu' },
  queenRookEndgame: { name: 'Tàn cuộc Hậu + Xe' },

  // Mục tiêu
  crushing: { name: 'Thắng áp đảo', desc: 'Tìm đòn giành lợi thế quyết định.' },
  advantage: { name: 'Giành ưu thế', desc: 'Tìm nước giành lợi thế rõ rệt.' },
  equality: { name: 'Cứu thế cờ', desc: 'Từ thế thua, tìm cách gỡ hòa hoặc cân bằng.' },

  // Độ dài
  oneMove: { name: 'Một nước' },
  short: { name: 'Ngắn (2 nước)' },
  long: { name: 'Dài (3 nước)' },
  veryLong: { name: 'Rất dài (4+ nước)' },

  // Nguồn
  master: { name: 'Ván của kiện tướng' },
  masterVsMaster: { name: 'Kiện tướng đấu kiện tướng' },
  superGM: { name: 'Ván siêu đại kiện tướng' },
};

export const THEME_GROUPS: { title: string; themes: string[] }[] = [
  {
    title: 'Đòn chiến thuật',
    themes: [
      'fork', 'pin', 'skewer', 'discoveredAttack', 'discoveredCheck', 'doubleCheck', 'sacrifice',
      'deflection', 'attraction', 'clearance', 'interference', 'intermezzo', 'xRayAttack',
      'capturingDefender', 'hangingPiece', 'trappedPiece', 'exposedKing', 'attackingF2F7',
      'kingsideAttack', 'queensideAttack', 'quietMove', 'defensiveMove', 'zugzwang',
      'advancedPawn', 'promotion', 'underPromotion', 'enPassant', 'castling', 'collinearMove',
    ],
  },
  {
    title: 'Chiếu hết',
    themes: [
      'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5', 'backRankMate', 'smotheredMate',
      'anastasiaMate', 'arabianMate', 'bodenMate', 'doubleBishopMate', 'dovetailMate', 'hookMate',
      'epauletteMate', 'operaMate', 'pillsburysMate', 'morphysMate', 'cornerMate', 'swallowstailMate',
      'killBoxMate', 'triangleMate', 'blindSwineMate', 'vukovicMate', 'balestraMate',
    ],
  },
  {
    title: 'Giai đoạn ván cờ',
    themes: [
      'opening', 'middlegame', 'endgame', 'pawnEndgame', 'rookEndgame', 'bishopEndgame',
      'knightEndgame', 'queenEndgame', 'queenRookEndgame',
    ],
  },
  { title: 'Mục tiêu', themes: ['mate', 'crushing', 'advantage', 'equality'] },
  { title: 'Độ dài', themes: ['oneMove', 'short', 'long', 'veryLong'] },
];

export function themeName(theme: string): string {
  return THEMES[theme]?.name ?? theme.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/** Themes that describe the puzzle's length or origin rather than a skill; hidden from weakness stats. */
export const NON_SKILL_THEMES = new Set([
  'oneMove', 'short', 'long', 'veryLong', 'master', 'masterVsMaster', 'superGM', 'crushing',
  'advantage', 'mate', 'middlegame',
]);
