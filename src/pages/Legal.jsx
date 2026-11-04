import { Copy, SheetHead } from '../components/Layout';
import terms from '../content/terms.json';

export default function Legal() {
  return (
    <>
      <SheetHead title="Terms of Use" />
      <Copy sections={terms.slice(1)} />
    </>
  );
}
