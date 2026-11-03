import { Copy, SheetHead } from '../components/Layout';
import privacy from '../content/privacy.json';
import terms from '../content/terms.json';

const DOCS = { privacy: ['Privacy Policy', privacy], terms: ['Terms of Use', terms] };

export default function Legal({ doc }) {
  const [title, sections] = DOCS[doc];
  return (
    <>
      <SheetHead title={title} />
      <Copy sections={sections.filter((s) => s.heading !== title)} />
    </>
  );
}
