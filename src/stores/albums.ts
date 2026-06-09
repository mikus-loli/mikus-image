import { create } from 'zustand';
import { albumsApi } from '@/lib/api';

interface Album {
  id: string;
  name: string;
  description?: string;
  image_count?: number;
  cover?: string;
  created_at?: string;
  updated_at?: string;
}

interface AlbumsState {
  albums: Album[];
  isLoaded: boolean;
  fetchAlbums: (force?: boolean) => Promise<Album[]>;
  invalidate: () => void;
}

export const useAlbumsStore = create<AlbumsState>((set, get) => ({
  albums: [],
  isLoaded: false,

  fetchAlbums: async (force = false) => {
    if (get().isLoaded && !force) return get().albums;
    try {
      const res = await albumsApi.getAlbums();
      const data = res.data.data;
      const albums = Array.isArray(data) ? data : [];
      set({ albums, isLoaded: true });
      return albums;
    } catch {
      return get().albums;
    }
  },

  invalidate: () => {
    set({ isLoaded: false });
  },
}));
