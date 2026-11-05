import { SheetGrid, SheetHead } from '../components/Layout';
import { People } from '../components/ui';
import { isAlumni, useTeams } from '../content/teams';

export default function Alumni() {
  const { data } = useTeams();
  const people = data?.filter((t) => isAlumni(t.roleName)).flatMap((t) => t.roleData) ?? [];
  return (
    <>
      <SheetHead title="Alumni" name="team-alumni" backdrop={<SheetGrid />}><p>Everyone who designed, built and flew for Quatlas before us, and where they went next.</p></SheetHead>
      <section className="wrap section">
        {people.length ? <People people={people} /> : <p className="text-ink-2">No alumni listed yet.</p>}
      </section>
    </>
  );
}
