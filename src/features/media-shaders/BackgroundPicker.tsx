import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePresentationStore } from "../presentation/store";
import { useMediaShadersStore } from "./store";

export function BackgroundPicker() {
  const presets = useMediaShadersStore((s) => s.presets);
  const current = useMediaShadersStore((s) => s.current);
  const setCurrent = useMediaShadersStore((s) => s.setCurrent);
  const setLiveBackground = usePresentationStore((s) => s.setBackground);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fundos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            variant={current.id === preset.id ? "default" : "secondary"}
            onClick={() => {
              setCurrent(preset);
              setLiveBackground(preset);
            }}
          >
            {preset.id.replace("bg-", "")} · {preset.kind}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
