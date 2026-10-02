// Interactive lessons. Every position is checked by lessons.test.ts (legal FEN and moves),
// and the "move" steps were checked with Stockfish 19 to be the best move.

export type Step =
  /** Text with a board; `showMoves` highlights where the piece on that square can go. */
  | { kind: 'explain'; text: string; fen?: string; arrows?: string[]; marks?: string[]; showMoves?: string }
  /** The user plays their side of `line`; the other side's moves are played automatically. */
  | { kind: 'move'; text: string; fen: string; line: string[]; hint?: string; done?: string }
  /** Click one of the `answers` squares. */
  | { kind: 'square'; text: string; fen?: string; answers: string[]; done?: string }
  | { kind: 'quiz'; text: string; fen?: string; options: string[]; answer: number; explain?: string }
  | { kind: 'puzzles'; text: string; theme: string; count: number }
  | { kind: 'link'; text: string; to: string; label: string };

export type Unit = 'basics' | 'tactics' | 'endgame';

export interface Lesson {
  id: string;
  unit: Unit;
  icon: string;
  title: string;
  summary: string;
  steps: Step[];
}

export const UNITS: { id: Unit; title: string; desc: string }[] = [
  { id: 'basics', title: 'Nền tảng', desc: 'Bàn cờ, cách đi quân, chiếu hết, nước đặc biệt và nguyên tắc khai cuộc.' },
  { id: 'tactics', title: 'Chiến thuật', desc: 'Các đòn phối hợp giúp thắng quân: chĩa đôi, ghim, xiên, tấn công mở và các mẫu chiếu hết.' },
  { id: 'endgame', title: 'Tàn cuộc', desc: 'Kỹ thuật chiếu hết cơ bản, đối vương, quy tắc hình vuông và tàn cuộc Xe.' },
];

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';

export const LESSONS: Lesson[] = [
  // ---------------- Nền tảng ----------------
  {
    id: 'board',
    unit: 'basics',
    icon: '🗺',
    title: 'Bàn cờ và tọa độ',
    summary: 'Tên các ô, thế cờ ban đầu.',
    steps: [
      {
        kind: 'explain',
        fen: EMPTY,
        marks: ['e4'],
        text: 'Bàn cờ có 64 ô: 8 **cột** từ a đến h (trái sang phải) và 8 **hàng** từ 1 đến 8 (từ phía quân Trắng). Mỗi ô được gọi bằng tên cột + tên hàng, ví dụ ô được tô sáng là **e4**.\n\nĐặt bàn sao cho ô ở góc dưới bên phải của bạn là ô **trắng**.',
      },
      { kind: 'square', fen: EMPTY, text: 'Bấm vào ô **e4**.', answers: ['e4'] },
      { kind: 'square', fen: EMPTY, text: 'Bấm vào ô **a8**.', answers: ['a8'], done: 'Đúng! a8 là góc trên bên trái khi bạn cầm Trắng.' },
      { kind: 'square', fen: EMPTY, text: 'Bấm vào ô **f3**.', answers: ['f3'] },
      {
        kind: 'explain',
        fen: START,
        text: 'Thế cờ ban đầu: quân Trắng ở hàng 1–2, quân Đen ở hàng 7–8. Hàng 2 và 7 là các quân **Tốt**. Hai góc là **Xe**, cạnh Xe là **Mã**, rồi đến **Tượng**. **Hậu** đứng ở ô cùng màu với mình (Hậu trắng ở d1, ô trắng), **Vua** đứng cạnh Hậu.\n\nTrắng luôn đi trước.',
      },
      { kind: 'square', fen: START, text: 'Bấm vào **Hậu trắng**.', answers: ['d1'] },
      { kind: 'square', fen: START, text: 'Bấm vào **Vua đen**.', answers: ['e8'] },
      { kind: 'quiz', text: 'Ô **h1** có màu gì?', options: ['Trắng', 'Đen'], answer: 0, explain: 'Góc dưới bên phải (h1) luôn là ô trắng.' },
      { kind: 'link', text: 'Muốn nhớ tọa độ nhanh hơn? Luyện 30 giây mỗi ngày.', to: '/train/vision', label: '🎯 Luyện tọa độ' },
    ],
  },
  {
    id: 'pieces',
    unit: 'basics',
    icon: '♞',
    title: 'Cách đi của các quân',
    summary: 'Xe, Tượng, Hậu, Mã, Vua và Tốt.',
    steps: [
      {
        kind: 'explain',
        fen: '8/7k/8/8/3R4/8/K7/8 w - - 0 1',
        showMoves: 'd4',
        text: '**Xe** đi theo hàng ngang và hàng dọc, bao nhiêu ô cũng được, nhưng không nhảy qua quân khác.',
      },
      {
        kind: 'explain',
        fen: '8/7k/8/8/3B4/8/K7/8 w - - 0 1',
        showMoves: 'd4',
        text: '**Tượng** đi theo đường chéo. Mỗi Tượng chỉ đi trên một màu ô suốt ván.',
      },
      {
        kind: 'explain',
        fen: '8/7k/8/8/3Q4/8/K7/8 w - - 0 1',
        showMoves: 'd4',
        text: '**Hậu** kết hợp Xe và Tượng: đi ngang, dọc và chéo. Đây là quân mạnh nhất.',
      },
      {
        kind: 'explain',
        fen: '8/7k/8/8/3N4/8/K7/8 w - - 0 1',
        showMoves: 'd4',
        text: '**Mã** đi hình chữ L: 2 ô theo một hướng rồi 1 ô sang bên. Mã là quân duy nhất **nhảy qua** được quân khác.',
      },
      {
        kind: 'explain',
        fen: '8/7k/8/8/3K4/8/8/8 w - - 0 1',
        showMoves: 'd4',
        text: '**Vua** đi 1 ô theo mọi hướng. Vua không bao giờ được đi vào ô đang bị đối phương tấn công.',
      },
      {
        kind: 'explain',
        fen: '8/7k/8/8/8/2p5/K2P4/8 w - - 0 1',
        showMoves: 'd2',
        text: '**Tốt** đi thẳng 1 ô (từ vị trí ban đầu được đi 2 ô), nhưng **ăn chéo** 1 ô về phía trước. Ở đây Tốt d2 có thể đi d3, d4 hoặc ăn Tốt đen ở c3.',
      },
      {
        kind: 'square',
        fen: '8/7k/8/8/3N4/8/K7/8 w - - 0 1',
        text: 'Mã ở d4 có thể đi tới ô nào? Bấm vào **một** ô bất kỳ.',
        answers: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'],
        done: 'Đúng! Mã ở giữa bàn có tới 8 ô để đi.',
      },
      { kind: 'move', fen: '3q3k/8/8/8/8/8/8/3R2K1 w - - 0 1', line: ['d1d8'], text: 'Dùng **Xe** ăn Hậu đen.' },
      { kind: 'move', fen: '7k/8/2r5/8/3N4/8/8/K7 w - - 0 1', line: ['d4c6'], text: 'Dùng **Mã** ăn Xe đen.' },
    ],
  },
  {
    id: 'check',
    unit: 'basics',
    icon: '👑',
    title: 'Chiếu, chiếu hết và hết nước đi',
    summary: 'Cách thắng (và hòa) một ván cờ.',
    steps: [
      {
        kind: 'explain',
        fen: '4k3/8/8/8/8/8/8/4R1K1 b - - 0 1',
        arrows: ['e1e8'],
        text: 'Khi Vua bị tấn công, ta nói Vua bị **chiếu**. Bên bị chiếu buộc phải thoát chiếu bằng một trong ba cách:\n1. **Chạy** Vua sang ô an toàn.\n2. **Chặn** đường chiếu bằng một quân khác.\n3. **Ăn** quân đang chiếu.',
      },
      {
        kind: 'move',
        fen: '4kb2/8/8/8/8/8/8/4R1K1 b - - 0 1',
        line: ['f8e7'],
        text: 'Bạn cầm Đen, Vua đang bị Xe chiếu. Hãy **chặn** đường chiếu bằng Tượng.',
        hint: 'Đặt Tượng vào giữa Xe trắng và Vua đen, ở ô được Vua bảo vệ.',
        done: 'Đúng! Tượng e7 chặn chiếu và được Vua bảo vệ.',
      },
      {
        kind: 'explain',
        fen: '3R2k1/5ppp/8/8/8/8/8/6K1 b - - 0 1',
        text: '**Chiếu hết**: Vua bị chiếu và không có cách nào thoát. Bên chiếu hết **thắng** ván cờ.\n\nỞ đây Vua đen bị Xe chiếu trên hàng 8 và bị chính các Tốt của mình chặn đường thoát.',
      },
      {
        kind: 'quiz',
        fen: 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1',
        text: 'Đến lượt Đen đi. Đây là gì?',
        options: ['Chiếu hết – Trắng thắng', 'Hết nước đi – ván cờ hòa', 'Ván cờ tiếp tục bình thường'],
        answer: 1,
        explain: 'Vua đen không bị chiếu nhưng không còn nước đi hợp lệ nào: đó là **hết nước đi (stalemate)** và ván cờ **hòa**. Khi đang thắng, hãy cẩn thận đừng để đối phương hết nước đi!',
      },
      { kind: 'move', fen: 'k7/8/1K6/8/8/8/8/4Q3 w - - 0 1', line: ['e1e8'], text: 'Chiếu hết trong **1 nước**.', hint: 'Vua đen chỉ còn các ô ở hàng 7 và 8. Hậu có thể kiểm soát cả hàng 8.' },
      { kind: 'move', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', line: ['d1d8'], text: 'Chiếu hết trong **1 nước**.', hint: 'Các Tốt đen đang nhốt chính Vua của mình ở hàng cuối.' },
    ],
  },
  {
    id: 'special',
    unit: 'basics',
    icon: '🏰',
    title: 'Nước đi đặc biệt',
    summary: 'Nhập thành, bắt tốt qua đường và phong cấp.',
    steps: [
      {
        kind: 'explain',
        fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
        arrows: ['e1g1', 'h1f1'],
        text: '**Nhập thành**: Vua đi 2 ô về phía Xe, rồi Xe nhảy qua đứng cạnh Vua. Điều kiện:\n• Vua và Xe đó chưa từng di chuyển.\n• Không có quân nào ở giữa.\n• Vua không đang bị chiếu, không đi qua hay đến ô bị tấn công.',
      },
      { kind: 'move', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', line: ['e1g1'], text: '**Nhập thành cánh Vua**: đi Vua từ e1 tới g1.' },
      { kind: 'move', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R4RK1 b kq - 1 1', line: ['e8c8'], text: 'Bạn cầm Đen. **Nhập thành cánh Hậu**: đi Vua từ e8 tới c8.' },
      {
        kind: 'explain',
        fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
        arrows: ['e5d6'],
        text: '**Bắt tốt qua đường**: Tốt đen vừa đi 2 ô (d7–d5) và đứng cạnh Tốt trắng ở e5. Ngay nước sau, Tốt trắng được ăn nó như thể nó chỉ đi 1 ô, bằng cách đi tới d6.',
      },
      { kind: 'move', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', line: ['e5d6'], text: 'Bắt Tốt d5 **qua đường**.' },
      {
        kind: 'explain',
        fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1',
        text: '**Phong cấp**: Tốt đi tới hàng cuối được đổi thành Hậu, Xe, Tượng hoặc Mã. Hầu như luôn chọn **Hậu**.',
      },
      { kind: 'move', fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', line: ['e7e8q'], text: 'Đưa Tốt lên e8 và phong thành **Hậu**.' },
    ],
  },
  {
    id: 'values',
    unit: 'basics',
    icon: '⚖️',
    title: 'Giá trị quân và trao đổi',
    summary: 'Biết quân nào đáng giá hơn để trao đổi có lợi.',
    steps: [
      {
        kind: 'explain',
        fen: START,
        text: 'Giá trị tương đối của các quân:\n• Tốt = **1**\n• Mã = **3**, Tượng = **3**\n• Xe = **5**\n• Hậu = **9**\n• Vua: vô giá (mất Vua là thua).\n\nKhi trao đổi, hãy đếm xem mình được bao nhiêu điểm và mất bao nhiêu.',
      },
      { kind: 'quiz', text: 'Bạn đổi Xe của mình lấy một Mã của đối phương. Kết quả là gì?', options: ['Có lợi 2 điểm', 'Ngang nhau', 'Thiệt 2 điểm'], answer: 2, explain: 'Xe (5) đổi lấy Mã (3): bạn thiệt 2 điểm, gọi là "mất chất lượng".' },
      { kind: 'quiz', text: 'Đổi Tượng lấy Mã thì sao?', options: ['Có lợi', 'Ngang nhau', 'Thiệt'], answer: 1, explain: 'Mã và Tượng cùng giá trị khoảng 3 điểm.' },
      {
        kind: 'move',
        fen: '4k3/8/8/7p/n5b1/8/8/3QK3 w - - 0 1',
        line: ['d1a4'],
        text: 'Hậu trắng có thể ăn Mã a4 hoặc Tượng g4. Quân nào **không được bảo vệ**? Hãy ăn nó.',
        hint: 'Tượng g4 được Tốt h5 bảo vệ. Nếu Hậu ăn Tượng, Tốt sẽ ăn lại Hậu.',
        done: 'Chính xác! Mã a4 không có ai bảo vệ, còn Qxa4 còn chiếu Vua.',
      },
    ],
  },
  {
    id: 'opening-principles',
    unit: 'basics',
    icon: '🚀',
    title: 'Nguyên tắc khai cuộc',
    summary: 'Chiếm trung tâm, ra quân, nhập thành.',
    steps: [
      {
        kind: 'explain',
        fen: START,
        marks: ['d4', 'e4', 'd5', 'e5'],
        text: 'Ba nguyên tắc vàng ở 10 nước đầu:\n1. **Chiếm trung tâm** (các ô d4, e4, d5, e5) bằng Tốt và quân.\n2. **Ra quân** nhanh: đưa Mã, Tượng ra trước; đừng đi một quân hai lần nếu không cần.\n3. **Nhập thành** sớm để Vua an toàn.\n\nTránh đưa Hậu ra quá sớm vì nó dễ bị đuổi đánh, làm mất nước đi.',
      },
      { kind: 'quiz', fen: START, text: 'Nước đầu tiên nào hợp nguyên tắc nhất?', options: ['1. e4', '1. a4', '1. h4', '1. Na3'], answer: 0, explain: '1. e4 chiếm trung tâm và mở đường cho Hậu, Tượng.' },
      {
        kind: 'move',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        line: ['f1c4'],
        text: 'Ra Tượng tới ô **c4**, nhắm vào ô yếu f7 cạnh Vua đen. (Đây là khai cuộc Italian.)',
      },
      {
        kind: 'move',
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        line: ['e1g1'],
        text: 'Mã và Tượng cánh Vua đã ra. Hãy **nhập thành** để đưa Vua về nơi an toàn.',
      },
      { kind: 'link', text: 'Khám phá tên và ý tưởng của hàng nghìn biến khai cuộc.', to: '/learn/openings', label: '📖 Cây khai cuộc' },
    ],
  },

  // ---------------- Chiến thuật ----------------
  {
    id: 'fork',
    unit: 'tactics',
    icon: '🍴',
    title: 'Chĩa đôi',
    summary: 'Một quân tấn công hai mục tiêu cùng lúc.',
    steps: [
      {
        kind: 'explain',
        fen: 'r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1',
        arrows: ['c7e8', 'c7a8'],
        text: '**Chĩa đôi** là khi một quân tấn công hai (hay nhiều) quân đối phương cùng lúc. Đối phương chỉ cứu được một.\n\nMã là quân chĩa đôi nguy hiểm nhất: ở đây Mã c7 vừa chiếu Vua vừa tấn công Xe.',
      },
      { kind: 'move', fen: 'r3k3/8/8/3N4/8/8/6PP/4K3 w - - 0 1', line: ['d5c7', 'e8d7', 'c7a8'], text: 'Dùng Mã **chĩa đôi** Vua và Xe, rồi ăn Xe.', hint: 'Tìm ô mà Mã chiếu Vua và tấn công Xe a8 cùng lúc.' },
      { kind: 'move', fen: 'r3k3/8/8/8/8/8/8/1Q2K3 w - - 0 1', line: ['b1e4', 'e8d8', 'e4a8'], text: 'Hậu cũng chĩa đôi rất giỏi. Chiếu Vua và tấn công Xe cùng lúc.', hint: 'Tìm ô vừa nằm trên cột e (chiếu Vua) vừa nằm trên đường chéo dẫn tới Xe a8.' },
      { kind: 'move', fen: '4k3/8/2n1b3/8/3PP3/8/8/R3K3 w - - 0 1', line: ['d4d5'], text: 'Ngay cả Tốt cũng chĩa đôi được! Tấn công cả Mã và Tượng.', done: 'Tốt d5 (được Tốt e4 bảo vệ) tấn công Mã c6 và Tượng e6. Đen sẽ mất một quân.' },
      { kind: 'puzzles', theme: 'fork', count: 5, text: 'Luyện 5 puzzle chĩa đôi.' },
    ],
  },
  {
    id: 'pin',
    unit: 'tactics',
    icon: '📌',
    title: 'Ghim',
    summary: 'Quân bị ghim không dám di chuyển.',
    steps: [
      {
        kind: 'explain',
        fen: '4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1',
        arrows: ['b5e8'],
        text: '**Ghim**: một quân bị tấn công không thể (hoặc không nên) di chuyển vì sẽ để lộ quân giá trị hơn phía sau.\n\nỞ đây Mã c6 bị Tượng b5 **ghim tuyệt đối** vào Vua: di chuyển Mã là phạm luật.',
      },
      { kind: 'move', fen: '4k3/8/2n5/1B6/3P4/8/8/4K3 w - - 0 1', line: ['d4d5'], text: 'Mã c6 đang bị ghim. Hãy **tấn công** nó thêm một lần nữa.', hint: 'Quân bị ghim không chạy được. Dùng một quân rẻ tiền để tấn công nó.' },
      {
        kind: 'move',
        fen: '4k3/8/4q3/8/8/8/5KPP/R7 w - - 0 1',
        line: ['a1e1'],
        text: 'Ghim Hậu đen vào Vua của nó.',
        hint: 'Hậu và Vua đen cùng nằm trên cột e.',
        done: 'Hậu bị ghim! Nếu Hậu ăn Xe thì Vua trắng ăn lại: đổi Xe lấy Hậu là lãi lớn.',
      },
      { kind: 'puzzles', theme: 'pin', count: 5, text: 'Luyện 5 puzzle ghim.' },
    ],
  },
  {
    id: 'skewer',
    unit: 'tactics',
    icon: '🍢',
    title: 'Xiên',
    summary: 'Tấn công quân giá trị, ăn quân phía sau.',
    steps: [
      {
        kind: 'explain',
        fen: '3q4/8/8/3k4/8/8/8/3RK3 b - - 0 1',
        arrows: ['d1d5', 'd5d8'],
        text: '**Xiên** ngược với ghim: quân giá trị cao đứng **trước**. Khi nó tránh đi, quân phía sau bị ăn.\n\nVua đen bị chiếu phải chạy khỏi cột d, và Hậu d8 sẽ mất.',
      },
      { kind: 'move', fen: '3q4/8/8/3k4/8/8/8/R3K3 w - - 0 1', line: ['a1d1', 'd5e5', 'd1d8'], text: 'Xiên Vua và Hậu đen trên cột d.' },
      { kind: 'move', fen: 'r7/8/8/3k4/8/8/6PP/3BK3 w - - 0 1', line: ['d1f3', 'd5d4', 'f3a8'], text: 'Lần này dùng **Tượng** xiên Vua và Xe trên đường chéo.', hint: 'Vua d5 và Xe a8 cùng nằm trên một đường chéo trắng.' },
      { kind: 'puzzles', theme: 'skewer', count: 5, text: 'Luyện 5 puzzle xiên.' },
    ],
  },
  {
    id: 'discovered',
    unit: 'tactics',
    icon: '💥',
    title: 'Tấn công mở',
    summary: 'Di chuyển một quân để mở đường cho quân khác.',
    steps: [
      {
        kind: 'explain',
        fen: '3k3q/8/8/8/3N4/8/1B3PPP/6K1 w - - 0 1',
        arrows: ['b2h8'],
        text: '**Tấn công mở**: quân phía trước di chuyển, mở đường cho quân phía sau tấn công. Nếu quân phía trước còn **chiếu** Vua (chiếu mở), đối phương không kịp cứu quân kia.\n\nMã d4 đang che đường chéo của Tượng b2 tới Hậu h8.',
      },
      { kind: 'move', fen: '3k3q/8/8/8/3N4/8/1B3PPP/6K1 w - - 0 1', line: ['d4e6', 'd8d7', 'b2h8'], text: 'Di chuyển Mã **chiếu Vua**, đồng thời mở đường cho Tượng ăn Hậu.', hint: 'Mã có thể chiếu Vua d8 từ ô nào?' },
      { kind: 'puzzles', theme: 'discoveredAttack', count: 5, text: 'Luyện 5 puzzle tấn công mở.' },
    ],
  },
  {
    id: 'back-rank',
    unit: 'tactics',
    icon: '🧱',
    title: 'Mate hàng cuối',
    summary: 'Vua bị chính các Tốt của mình nhốt.',
    steps: [
      {
        kind: 'explain',
        fen: '3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1',
        text: 'Khi Vua đã nhập thành và ba Tốt phía trước chưa di chuyển, Vua không có lối thoát lên trên. Một Xe hoặc Hậu chiếu ở hàng cuối là **chiếu hết**.\n\nCách phòng tránh: tạo "lỗ thở" bằng cách đẩy một Tốt (h3/h6) khi có thời gian.',
      },
      { kind: 'move', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', line: ['d1d8'], text: 'Chiếu hết ở hàng cuối.' },
      { kind: 'puzzles', theme: 'backRankMate', count: 5, text: 'Luyện 5 puzzle mate hàng cuối.' },
    ],
  },
  {
    id: 'smothered',
    unit: 'tactics',
    icon: '🫢',
    title: 'Mate ngộp',
    summary: 'Mã chiếu hết Vua bị quân nhà vây kín.',
    steps: [
      {
        kind: 'explain',
        fen: '6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1',
        text: '**Mate ngộp**: Vua bị các quân của chính mình bao quanh nên một Mã là đủ chiếu hết.',
      },
      { kind: 'move', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', line: ['g5f7'], text: 'Chiếu hết bằng Mã.' },
      {
        kind: 'move',
        fen: '5r1k/6pp/7N/3Q4/8/8/8/6K1 w - - 0 1',
        line: ['d5g8', 'f8g8', 'h6f7'],
        text: 'Thế cờ kinh điển "di sản Philidor": **thí Hậu** để buộc Xe đen tự nhốt Vua, rồi chiếu hết bằng Mã.',
        hint: 'Chiếu ở g8. Vua không ăn được Hậu vì Mã h6 bảo vệ ô đó.',
      },
      { kind: 'puzzles', theme: 'smotheredMate', count: 3, text: 'Luyện 3 puzzle mate ngộp.' },
    ],
  },
  {
    id: 'remove-defender',
    unit: 'tactics',
    icon: '🛡',
    title: 'Diệt quân phòng thủ',
    summary: 'Loại bỏ quân đang bảo vệ, rồi tấn công.',
    steps: [
      {
        kind: 'explain',
        fen: '5rk1/5ppp/5n2/6BQ/8/3B4/8/6K1 w - - 0 1',
        arrows: ['h5h7', 'd3h7', 'f6h7'],
        text: 'Hậu và Tượng trắng cùng nhắm vào h7. Chỉ có **Mã f6** đang bảo vệ ô h7 (và còn đang tấn công Hậu!).\n\nNếu loại bỏ được Mã này, Hậu sẽ chiếu hết ở h7.',
      },
      { kind: 'move', fen: '5rk1/5ppp/5n2/6BQ/8/3B4/8/6K1 w - - 0 1', line: ['g5f6'], text: 'Diệt quân phòng thủ.', done: 'Mã f6 đã bị loại. Đen không thể ngăn Qxh7# nữa.' },
      { kind: 'puzzles', theme: 'capturingDefender', count: 5, text: 'Luyện 5 puzzle diệt quân phòng thủ.' },
    ],
  },

  // ---------------- Tàn cuộc ----------------
  {
    id: 'queen-mate',
    unit: 'endgame',
    icon: '👸',
    title: 'Chiếu hết bằng Hậu',
    summary: 'Kỹ thuật "chiếc hộp" thu hẹp Vua đối phương.',
    steps: [
      {
        kind: 'explain',
        fen: '8/8/8/3k4/8/2Q5/8/4K3 b - - 0 1',
        text: 'Hậu tạo một "chiếc hộp" giam Vua đen. Mỗi nước, hãy thu nhỏ hộp lại bằng cách đặt Hậu **cách Vua một nước Mã**, cho tới khi Vua đen bị dồn ra mép bàn.\n\nSau đó đưa Vua trắng lại gần để hỗ trợ chiếu hết.',
      },
      {
        kind: 'quiz',
        fen: 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1',
        text: 'Đây là sai lầm phổ biến nhất khi chiếu hết bằng Hậu. Chuyện gì đã xảy ra?',
        options: ['Đen hết nước đi: ván cờ hòa', 'Đen bị chiếu hết', 'Hậu sắp bị ăn'],
        answer: 0,
        explain: 'Khi thu hẹp hộp, luôn chừa cho Vua đen ít nhất một ô để đi, cho đến nước chiếu hết.',
      },
      { kind: 'move', fen: 'k7/8/1K6/8/8/8/8/4Q3 w - - 0 1', line: ['e1e8'], text: 'Kết thúc: chiếu hết trong 1 nước.' },
      { kind: 'link', text: 'Giờ hãy tự chiếu hết từ đầu, Stockfish sẽ phòng thủ tốt nhất có thể.', to: '/train/drills/mate-queen', label: '🏁 Drill: Hậu + Vua' },
    ],
  },
  {
    id: 'opposition',
    unit: 'endgame',
    icon: '♔',
    title: 'Đối vương',
    summary: 'Chìa khóa của tàn cuộc Tốt.',
    steps: [
      {
        kind: 'explain',
        fen: '8/8/4k3/8/4K3/8/4P3/8 b - - 0 1',
        marks: ['e4', 'e6'],
        text: '**Đối vương**: hai Vua đứng đối diện nhau, cách đúng một ô. Bên **không phải đi** là bên "giữ đối vương" và có lợi, vì Vua kia phải nhường đường.\n\nTrong tàn cuộc Vua + Tốt đấu Vua, bên tấn công giữ đối vương thường thắng; bên phòng thủ giữ đối vương thường hòa.',
      },
      {
        kind: 'move',
        fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
        line: ['e2e3'],
        text: 'Trắng đi. Hai Vua đang đối diện, nhưng đến lượt Trắng nên Trắng không giữ đối vương. Có cách nào **chuyển lượt** không?',
        hint: 'Tốt vẫn còn một nước đi "chờ".',
        done: 'Tuyệt! Tốt đi một ô, giờ Đen phải đi và Vua đen phải nhường đường.',
      },
      { kind: 'link', text: 'Thực hành đầy đủ: phong cấp Tốt trước Stockfish.', to: '/train/drills/pawn-opposition', label: '🏁 Drill: thắng bằng đối vương' },
      { kind: 'link', text: 'Và phía ngược lại: cầm Đen giữ hòa.', to: '/train/drills/pawn-defend', label: '🏁 Drill: phòng thủ' },
    ],
  },
  {
    id: 'square-rule',
    unit: 'endgame',
    icon: '⬛',
    title: 'Quy tắc hình vuông',
    summary: 'Vua có đuổi kịp Tốt không?',
    steps: [
      {
        kind: 'explain',
        fen: '7k/8/8/p7/8/8/8/5K2 w - - 0 1',
        marks: ['a5', 'b5', 'c5', 'd5', 'e5', 'e4', 'e3', 'e2', 'e1', 'a1', 'b1', 'c1', 'd1', 'a4', 'a3', 'a2'],
        text: 'Vẽ một hình vuông có cạnh là đường đi của Tốt tới hàng phong cấp (ở đây từ a5 tới a1, cạnh 5 ô).\n\nNếu Vua **bước được vào hình vuông** (tính cả lượt đi), Vua sẽ đuổi kịp Tốt.',
      },
      {
        kind: 'square',
        fen: '7k/8/8/p7/8/8/8/5K2 w - - 0 1',
        text: 'Trắng đi. Vua trắng nên đi tới ô nào để vào hình vuông?',
        answers: ['e1', 'e2'],
        done: 'Đúng! Vua đã vào hình vuông và sẽ bắt kịp Tốt.',
      },
      { kind: 'link', text: 'Thử đuổi Tốt trước Stockfish.', to: '/train/drills/pawn-square', label: '🏁 Drill: quy tắc hình vuông' },
    ],
  },
  {
    id: 'rook-endgames',
    unit: 'endgame',
    icon: '♜',
    title: 'Lucena và Philidor',
    summary: 'Hai thế cờ quan trọng nhất của tàn cuộc Xe.',
    steps: [
      {
        kind: 'explain',
        fen: '1K6/1P2k3/8/8/8/8/r7/3R4 w - - 0 1',
        arrows: ['d1d4'],
        text: '**Thế Lucena** (bên mạnh thắng): Vua trắng bị kẹt ở ô phong cấp. Kỹ thuật "**bắc cầu**": đưa Xe lên hàng 4, đưa Vua ra ngoài, rồi dùng Xe chặn các nước chiếu của Xe đen.',
      },
      { kind: 'link', text: 'Tự thực hiện Lucena trước Stockfish.', to: '/train/drills/rook-lucena', label: '🏁 Drill: Lucena' },
      {
        kind: 'explain',
        fen: '4k3/R7/7r/3KP3/8/8/8/8 b - - 0 1',
        marks: ['a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6'],
        text: '**Thế Philidor** (bên yếu hòa): Xe đen đứng ở **hàng 6**, ngăn Vua trắng tiến lên. Khi Tốt trắng tiến lên e6, Xe đen chuyển xuống hàng 1 và chiếu từ phía sau: Vua trắng không còn chỗ trốn.',
      },
      { kind: 'link', text: 'Cầm Đen giữ hòa thế Philidor.', to: '/train/drills/rook-philidor', label: '🏁 Drill: Philidor' },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
