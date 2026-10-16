import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useSongsStore } from "@/features/songs/store";
import { usePreferencesStore } from "@/features/preferences/store";

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

      <MenubarMenu>
        <MenubarTrigger>Editar</MenubarTrigger>
        <MenubarContent>
          <MenubarItem
            onSelect={() => usePreferencesStore.getState().openPreferences()}
          >
            Preferências…
            <MenubarShortcut>⌘,</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
