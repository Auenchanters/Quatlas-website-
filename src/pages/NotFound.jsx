import { Link } from 'react-router';
import { SheetHead } from '../components/Layout';
import Meta from '../components/Meta';

export default function NotFound() {
  return (
    <SheetHead title="Sheet not found">
      <Meta title="Page not found" description="This page isn’t on the Quatlas site." noindex />
      <p>This page isn’t in the set. It may have moved, or the link has a typo.</p>
      <Link to="/" className="btn mt-6">Back to the home page</Link>
    </SheetHead>
  );
}
