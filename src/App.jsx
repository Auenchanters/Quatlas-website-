import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import Home from './pages/Home';
import { Toaster } from './lib/toast';
import ThemeSlider from './components/ThemeSlider';

// Home ships in the entry chunk; everything else loads with its route, so visitors never download admin code.
const page = (load) => lazy(load);
const About = page(() => import('./pages/About'));
const Achievements = page(() => import('./pages/Achievements'));
const Team = page(() => import('./pages/Team'));
const Subteam = page(() => import('./pages/Subteam'));
const Events = page(() => import('./pages/Events'));
const Support = page(() => import('./pages/Support'));
const Hangar = page(() => import('./pages/Hangar'));
const Contact = page(() => import('./pages/Contact'));
const Alumni = page(() => import('./pages/Alumni'));
const Gallery = page(() => import('./pages/Gallery'));
const Recruitment = page(() => import('./pages/Recruitment'));
const Legal = page(() => import('./pages/Legal'));
const Results = page(() => import('./pages/Results'));
const NotFound = page(() => import('./pages/NotFound'));
const Auth = page(() => import('./pages/Auth'));

// Admin: one chunk per screen, behind AdminLayout's token check.
const AdminLayout = page(() => import('./admin/AdminLayout'));
const Dashboard = page(() => import('./admin/Dashboard'));
const AdminRecruitment = page(() => import('./admin/Recruitment'));
const Forms = page(() => import('./admin/Forms'));
const TeamData = page(() => import('./admin/Team'));
const Links = page(() => import('./admin/Links'));
const Account = page(() => import('./admin/Account'));

export default function App() {
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
      <ThemeSlider />
      <Toaster />
    </>
  );
}
