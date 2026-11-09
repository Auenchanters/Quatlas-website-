import { useLocation } from 'react-router';
import { NAME, SITE } from '../content/meta';

// Title, description, canonical link and share card for the current page. React hoists these into
// <head>; the prerender moves them there in the static HTML too.
export default function Meta({ title, description, noindex = false }) {
  const { pathname } = useLocation();
  const full = title ? `${title} | ${NAME}` : `${NAME} | Ramaiah Institute of Technology`;
  const url = SITE + (pathname === '/' ? '' : pathname);
  return (
    <>
      <title>{full}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex" />}
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={NAME} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${SITE}/og.jpg`} />
      <meta name="twitter:card" content="summary_large_image" />
    </>
  );
}
