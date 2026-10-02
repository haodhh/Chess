import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Chess } from 'chess.js';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Key } from '@lichess-org/chessground/types';
import { Board } from '../../components/Board';
import { LineTrainer, type LineStatus } from '../../components/LineTrainer';
import { PuzzlePlayer, type PuzzleOutcome } from '../../components/PuzzlePlayer';
import { RichText } from '../../components/RichText';
import { parseUci } from '../../core/chess';
import type { Puzzle } from '../../core/puzzle';
import { playSound } from '../../core/sound';
import { LESSONS, lessonById, type Lesson, type Step } from '../../content/lessons';
import type { Settings } from '../../data/db';
import { completeLesson } from '../../data/learn';
import { findPuzzle } from '../../data/puzzleData';
import { attemptedIds, currentRating, recordAttempt, useProfile } from '../../data/store';

const START = new Chess().fen();
const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';

export function LessonPage() {
  const { id = '' } = useParams();
  const lesson = lessonById(id);
  if (!lesson) return <div className="card">Không tìm thấy bài học.</div>;
  return <LessonRun key={lesson.id} lesson={lesson} />;
}

const starsFor = (mistakes: number) => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);

function LessonRun({ lesson }: { lesson: Lesson }) {
  const profile = useProfile();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);
  const step = lesson.steps[index];

  const markDone = useCallback(() => setDone(true), []);
  const addMistake = useCallback(() => setMistakes((m) => m + 1), []);

  useEffect(() => {
    setDone(step.kind === 'explain' || step.kind === 'link');
  }, [index, step.kind]);

  const next = () => {
    if (index + 1 < lesson.steps.length) {
      setIndex(index + 1);
      return;
    }
    setFinished(true);
    playSound('success');
    void completeLesson(lesson.id, starsFor(mistakes));
  };

  if (!profile) return null;
  const settings = profile.settings;
  const nextLesson = LESSONS[LESSONS.findIndex((l) => l.id === lesson.id) + 1];

  const panelTop = (
    <>
      {/* On phones the step text and buttons come first, right under the board. */}
      <Link to="/learn" className="back-link order-last lg:order-none">
        ← Lộ trình học
      </Link>
      <div className="card order-1 lg:order-none">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{lesson.icon}</span>
          <h1 className="text-lg font-bold">{lesson.title}</h1>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${((index + (done || finished ? 1 : 0)) / lesson.steps.length) * 100}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-muted">
          Bước {index + 1}/{lesson.steps.length}
        </div>
      </div>
    </>
  );

  if (finished) {
    const stars = starsFor(mistakes);
    return (
      <div className="mx-auto max-w-md">
        <div className="card text-center">
          <div className="text-5xl">{lesson.icon}</div>
          <h1 className="mt-2 text-2xl font-extrabold">Hoàn thành bài học!</h1>
          <div className="my-2 text-4xl text-warn">
            {'★'.repeat(stars)}
            <span className="text-white/20">{'★'.repeat(3 - stars)}</span>
          </div>
          <p className="text-sm text-muted">{mistakes === 0 ? 'Không sai lần nào. Xuất sắc!' : `Bạn sai ${mistakes} lần.`}</p>
          <div className="mt-4 flex flex-col gap-2">
            {nextLesson && (
              <Link className="btn btn-primary" to={`/learn/lesson/${nextLesson.id}`}>
                Bài tiếp theo: {nextLesson.title} →
              </Link>
            )}
            <Link className="btn" to="/learn">
              Về lộ trình
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const nextButton = (
    <button className="btn btn-primary text-lg" disabled={!done} onClick={next}>
      {index + 1 < lesson.steps.length ? 'Tiếp tục →' : 'Hoàn thành'}
    </button>
  );

  if (step.kind === 'puzzles') {
    return (
      <PuzzleStep
        key={index}
        step={step}
        settings={settings}
        rating={currentRating(profile).rating}
        onDone={markDone}
        header={
          <>
            {panelTop}
            <div className="card">
              <RichText text={step.text} />
            </div>
          </>
        }
        footer={done ? nextButton : null}
      />
    );
  }

  return (
    <div className="game-layout">
      <div className="board-col">
        <StepBoard key={index} step={step} settings={settings} onDone={markDone} onMistake={addMistake} />
      </div>
      <aside className="flex flex-col gap-3">
        {panelTop}
        <StepPanel key={index} step={step} done={done} onDone={markDone} onMistake={addMistake} />
        {nextButton}
      </aside>
    </div>
  );
}

/** The board side of a step. Move and square steps report success through `onDone`. */
function StepBoard({
  step,
  settings,
  onDone,
  onMistake,
}: {
  step: Step;
  settings: Settings;
  onDone: () => void;
  onMistake: () => void;
}) {
  const [flash, setFlash] = useState<Map<Key, string>>(new Map());
  const [solved, setSolved] = useState(false);
  const fen = ('fen' in step && step.fen) || (step.kind === 'square' ? EMPTY : START);
  const turn = fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const orientation = step.kind === 'move' ? turn : 'white';

  const highlights = useMemo(() => {
    const m = new Map<Key, string>(flash);
    if (step.kind === 'explain') {
      for (const s of step.marks ?? []) m.set(s as Key, 'lesson-mark');
      if (step.showMoves) {
        for (const mv of new Chess(fen).moves({ square: step.showMoves as never, verbose: true })) {
          m.set(mv.to, 'lesson-dest');
        }
        m.set(step.showMoves as Key, 'lesson-mark');
      }
    }
    return m;
  }, [step, fen, flash]);

  const shapes = useMemo<DrawShape[]>(
    () =>
      step.kind === 'explain'
        ? (step.arrows ?? []).map((a) => {
            const { from, to } = parseUci(a);
            return { orig: from, dest: to, brush: 'green' };
          })
        : [],
    [step],
  );

  if (step.kind === 'move') {
    return (
      <LineTrainer
        fen={step.fen}
        line={step.line}
        settings={settings}
        onStatus={(s: LineStatus) => s === 'wrong' && onMistake()}
        onDone={onDone}
      />
    );
  }

  return (
    <Board
      fen={fen}
      orientation={orientation}
      turnColor={turn}
      highlights={highlights}
      shapes={shapes}
      coordinates={step.kind === 'square' ? false : settings.coordinates}
      animation={settings.animation}
      theme={settings.boardTheme}
      onSelect={(k) => {
        if (step.kind !== 'square' || solved) return;
        const ok = step.answers.includes(k);
        setFlash(new Map([[k, ok ? 'vision-ok' : 'vision-bad']]));
        if (ok) {
          playSound('success');
          setSolved(true);
          onDone();
        } else {
          playSound('error');
          onMistake();
          window.setTimeout(() => setFlash(new Map()), 400);
        }
      }}
    />
  );
}

/** The text side of a step: instructions, quiz options and feedback. */
function StepPanel({
  step,
  done,
  onDone,
  onMistake,
}: {
  step: Step;
  done: boolean;
  onDone: () => void;
  onMistake: () => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);

  return (
    <div className={`card ${done && step.kind !== 'explain' && step.kind !== 'link' ? 'border border-good/60' : ''}`}>
      <RichText text={step.text} className="text-[15px] leading-relaxed text-stone-200" />

      {step.kind === 'quiz' && (
        <div className="mt-3 flex flex-col gap-2">
          {step.options.map((o, i) => {
            const chosen = picked.includes(i);
            const right = i === step.answer;
            return (
              <button
                key={i}
                disabled={done}
                className={`btn justify-start text-left ${chosen ? (right ? 'bg-good/40' : 'bg-bad/40') : ''}`}
                onClick={() => {
                  setPicked([...picked, i]);
                  if (right) {
                    playSound('success');
                    onDone();
                  } else {
                    playSound('error');
                    onMistake();
                  }
                }}
              >
                {o}
              </button>
            );
          })}
          {done && step.explain && <RichText text={step.explain} className="mt-1 text-sm text-muted" />}
        </div>
      )}

      {step.kind === 'move' && (
        <MoveFeedback step={step} done={done} />
      )}

      {step.kind === 'square' && done && <div className="mt-2 text-sm text-good">✓ {step.done ?? 'Chính xác!'}</div>}

      {step.kind === 'link' && (
        <Link to={step.to} className="btn mt-3 w-full">
          {step.label}
        </Link>
      )}
    </div>
  );
}

function MoveFeedback({ step, done }: { step: Extract<Step, { kind: 'move' }>; done: boolean }) {
  const [showHint, setShowHint] = useState(false);
  if (done) return <div className="mt-2 text-sm text-good">✓ {step.done ?? 'Chính xác!'}</div>;
  return (
    <div className="mt-3">
      {step.hint &&
        (showHint ? (
          <div className="rounded-lg bg-white/5 p-2 text-sm text-muted">💡 {step.hint}</div>
        ) : (
          <button className="btn btn-sm" onClick={() => setShowHint(true)}>
            💡 Gợi ý
          </button>
        ))}
      <p className="mt-2 text-xs text-muted">Đi sai 2 lần, mũi tên xanh sẽ chỉ đáp án.</p>
    </div>
  );
}

/** A short set of themed puzzles inside a lesson; unrated. */
function PuzzleStep({
  step,
  settings,
  rating,
  onDone,
  header,
  footer,
}: {
  step: Extract<Step, { kind: 'puzzles' }>;
  settings: Settings;
  rating: number;
  onDone: () => void;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [count, setCount] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      seen.current ??= await attemptedIds();
      // Lesson puzzles are a little easier than the player's rating.
      const p = await findPuzzle({ target: rating - 200, theme: step.theme, exclude: seen.current });
      if (!p) throw new Error('Không tìm thấy puzzle phù hợp.');
      seen.current.add(p.id);
      setPuzzle(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [rating, step.theme]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <div className="card text-bad">{error}</div>;
  if (!puzzle) return <div className="text-muted">Đang tải puzzle…</div>;

  const finished = count >= step.count;
  const onResult = (o: PuzzleOutcome) => {
    void recordAttempt({ puzzle, mode: 'theme', ...o, rated: false });
    setResults((r) => [...r, o.success]);
  };

  return (
    <PuzzlePlayer
      key={puzzle.id}
      puzzle={puzzle}
      settings={settings}
      onResult={onResult}
      onFinished={() => {
        const c = count + 1;
        setCount(c);
        if (c >= step.count) onDone();
      }}
      onNext={finished ? undefined : load}
      header={
        <>
          {header}
          <div className="card">
            <div className="text-sm text-muted">
              Puzzle {Math.min(count + 1, step.count)}/{step.count}
            </div>
            <div className="mt-1 flex gap-1">
              {Array.from({ length: step.count }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 flex-1 rounded-full ${i < results.length ? (results[i] ? 'bg-good' : 'bg-bad') : 'bg-white/10'}`}
                />
              ))}
            </div>
          </div>
        </>
      }
      footer={footer}
    />
  );
}
