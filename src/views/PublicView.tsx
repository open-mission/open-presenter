import { usePresentationSync } from "@/core/sync/usePresentationSync";
import { usePresentationStore } from "@/features/presentation/store";
import { SlideCanvas } from "@/features/presentation/SlideCanvas";

export default function PublicView() {
  usePresentationSync();
  const live = usePresentationStore((s) => s.live);

  return (
    <div className="h-full w-full bg-black">
      <SlideCanvas slide={live} />
    </div>
  );
}
