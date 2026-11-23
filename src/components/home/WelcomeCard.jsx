// V1 Welcome (approved design 9de1df2, screen "welcome"): Home when the family
// has no children yet. The approved map is release-gated (V1-F-DESIGN §3): the
// build supplies its URL only once its licence gate is cleared; until then the
// card shows without it.
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function WelcomeCard({ onAddFirstChild }) {
  const map = import.meta.env.VITE_WELCOME_MAP;
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-4 py-8 text-center sm:px-8">
        {map && (
          <img src={map} alt="" aria-hidden="true" width={192} height={192}
            className="h-48 w-48 rounded-lg bg-warning p-4" />
        )}
        <h1 className="font-display font-extrabold text-title text-primary">Every adventure starts with a goal!</h1>
        <p className="max-w-md text-muted-foreground">
          Add your first child, recognise positive behaviours, and choose a little treat or something bigger to save towards.
        </p>
        <Button onClick={onAddFirstChild}>Add your first child</Button>
      </CardContent>
    </Card>
  );
}
