import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useSongsStore } from "@/features/songs/store";

export function AppMenubar() {
  return (
    <Menubar className="w-fit">
      <MenubarMenu>
        <MenubarTrigger>Arquivo</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onSelect={() => useSongsStore.getState().startNewSong()}>
            Nova música
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
            onSelect={() => useSongsStore.getState().startHolyricsImport()}
          >
            Importar músicas do Holyrics…
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
