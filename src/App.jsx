import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import Home from './pages/Home';
import { Toaster } from './lib/toast';

// Home ships in the entry chunk; everything else loads with its route, so visitors never download admin code.
// Once the first page is idle, the public pages' chunks are fetched ahead, so moving between pages
// doesn't wait on the network (each is a few KB; the games and admin screens are left out).
const PAGES = {
  About: () => import('./pages/About'), Achievements: () => import('./pages/Achievements'), Team: () => import('./pages/Team'),
  Subteam: () => import('./pages/Subteam'), Events: () => import('./pages/Events'), Support: () => import('./pages/Support'),
  Hangar: () => import('./pages/Hangar'), Contact: () => import('./pages/Contact'), Alumni: () => import('./pages/Alumni'),
  Gallery: () => import('./pages/Gallery'), Recruitment: () => import('./pages/Recruitment'), Legal: () => import('./pages/Legal'),
  NotFound: () => import('./pages/NotFound'),
};
const { About, Achievements, Team, Subteam, Events, Support, Hangar, Contact, Alumni, Gallery, Recruitment, Legal, NotFound } =
  Object.fromEntries(Object.entries(PAGES).map(([k, load]) => [k, lazy(load)]));
const Results = lazy(() => import('./pages/Results'));
const Auth = lazy(() => import('./pages/Auth'));

function usePrefetch() {
  useEffect(() => {
    if (navigator.connection?.saveData) return;
    let id;
    const go = () => { id = (window.requestIdleCallback ?? setTimeout)(() => Object.values(PAGES).forEach((load) => load().catch(() => {})), { timeout: 4000 }); };
    document.readyState === 'complete' ? go() : addEventListener('load', go, { once: true });
    return () => { removeEventListener('load', go); (window.cancelIdleCallback ?? clearTimeout)(id); };
  }, []);
}

// Admin: one chunk per screen, behind AdminLayout's token check.
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const Dashboard = lazy(() => import('./admin/Dashboard'));
const AdminRecruitment = lazy(() => import('./admin/Recruitment'));
const Forms = lazy(() => import('./admin/Forms'));
const TeamData = lazy(() => import('./admin/Team'));
const Links = lazy(() => import('./admin/Links'));
const Account = lazy(() => import('./admin/Account'));

export default function App() {
  usePrefetch();
  return (
    <>
      <Suspense fallback={<div className="min-h-dvh" />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="team" element={<Team />} />
            <Route path="team/:slug" element={<Subteam />} />
            <Route path="events" element={<Events />} />
            <Route path="support" element={<Support />} />
            <Route path="sponsors" element={<Navigate to="/support" replace />} />
            <Route path="crowdfunding" element={<Navigate to="/support#crowdfunding" replace />} />
            <Route path="hangar" element={<Hangar />} />
            <Route path="hangar/:game" element={<Hangar />} />
            <Route path="contact" element={<Contact />} />
            <Route path="alumini" element={<Alumni />} />
            <Route path="alumni" element={<Navigate to="/alumini" replace />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="recruitment" element={<Recruitment />} />
            <Route path="privacy" element={<Navigate to="/terms" replace />} />
            <Route path="terms" element={<Legal />} />
            <Route path="results" element={<Results />} />
            <Route path="resultPage" element={<Results result />} />
            <Route path="login" element={<Auth view="login" />} />
            <Route path="signup" element={<Auth view="signup" />} />
            <Route path="resetPassword" element={<Auth view="reset" />} />
            <Route path="verifyUser" element={<Auth view="verifyUser" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route element={<AdminLayout />}>
            <Route path="Data" element={<Dashboard />} />
            <Route path="recruitmentData" element={<AdminRecruitment />} />
            <Route path="recruitdata" element={<AdminRecruitment />} />
            <Route path="forms" element={<Forms />} />
            <Route path="teamData" element={<TeamData />} />
            <Route path="links" element={<Links />} />
            <Route path="admin" element={<Account />} />
            <Route path="updateEmail" element={<Account view="email" />} />
            <Route path="updatePassword" element={<Account view="password" />} />
            <Route path="verify" element={<Account view="verify" />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
