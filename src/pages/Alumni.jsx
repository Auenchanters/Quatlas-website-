import { SheetHead } from '../components/Layout';
import { Failed, Loading, People } from '../components/ui';
import { useApi } from '../lib/api';

export default function Alumni() {
  const { data, error, loading, reload } = useApi('/members/memberData', {
    map: (d) => d[0].teams.find((t) => t.roleName === 'Alumini')?.roleData ?? [],
  });
  return (
    <>
      <SheetHead title="Quatlas Alumni" />
      <section className="wrap py-12 md:py-16">
        {loading && <Loading rows={4} label="Loading alumni" />}
        {error && <Failed error={error} retry={reload} />}
        {data && (data.length ? <People people={data} /> : <p className="text-ink-2">No alumni listed yet.</p>)}
      </section>
    </>
  );
}
