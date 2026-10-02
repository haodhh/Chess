import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { setSoundEnabled } from './core/sound';
import { useProfile } from './data/store';
import { startAutoSync } from './data/sync';
import { Daily } from './pages/Daily';
import { Home } from './pages/Home';
import { RatedPuzzles } from './pages/RatedPuzzles';
import { Review } from './pages/Review';
import { Rush } from './pages/Rush';
import { SettingsPage } from './pages/Settings';
import { Stats } from './pages/Stats';
import { ThemePuzzles, Themes } from './pages/Themes';
import { LearnHub } from './pages/learn/LearnHub';
import { LessonPage } from './pages/learn/LessonPage';
import { Openings } from './pages/learn/Openings';
import { RepertoirePage } from './pages/learn/RepertoirePage';
import { Analysis } from './pages/train/Analysis';
import { DrillPage, Drills } from './pages/train/Drills';
import { GameReview } from './pages/train/GameReview';
import { Games } from './pages/train/Games';
import { Play } from './pages/train/Play';
import { TrainHub } from './pages/train/TrainHub';
import { Vision } from './pages/train/Vision';

export function App() {
  const profile = useProfile();
  useEffect(() => {
    if (profile) setSoundEnabled(profile.settings.sound);
  }, [profile]);
  useEffect(() => startAutoSync(), []);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="puzzles" element={<RatedPuzzles />} />
          <Route path="themes" element={<Themes />} />
          <Route path="themes/:theme" element={<ThemePuzzles />} />
          <Route path="rush" element={<Rush />} />
          <Route path="review" element={<Review />} />
          <Route path="daily" element={<Daily />} />
          <Route path="stats" element={<Stats />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="train" element={<TrainHub />} />
          <Route path="train/play" element={<Play />} />
          <Route path="train/games" element={<Games />} />
          <Route path="train/review/:id" element={<GameReview />} />
          <Route path="train/drills" element={<Drills />} />
          <Route path="train/drills/:id" element={<DrillPage />} />
          <Route path="train/vision" element={<Vision />} />
          <Route path="train/analysis" element={<Analysis />} />
          <Route path="learn" element={<LearnHub />} />
          <Route path="learn/lesson/:id" element={<LessonPage />} />
          <Route path="learn/openings" element={<Openings />} />
          <Route path="learn/repertoire" element={<RepertoirePage />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
