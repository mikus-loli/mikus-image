import { create } from 'zustand';
import { imagesApi } from '@/lib/api';

interface ImageItem {
  id: string;
  filename: string;
  original_name: string;
  url: string;
  thumbnail_url: string;
  size: number;
  width: number;
  height: number;
  mime_type: string;
  permission: 'public' | 'private';
  album_id?: string;
  tags: string[];
  views: number;
  created_at: string;
}

interface ImagesState {
  images: ImageItem[];
  currentImage: ImageItem | null;
  total: number;
  page: number;
  filters: {
    keyword?: string;
    album_id?: string;
    permission?: string;
  };
  selectedIds: Set<string>;
  isLoading: boolean;
  fetchImages: (page?: number, filters?: Record<string, string>) => Promise<void>;
  fetchImage: (id: string) => Promise<void>;
  uploadImages: (formData: FormData, onProgress?: (percent: number) => void) => Promise<unknown>;
  deleteImage: (id: string) => Promise<void>;
  updateImage: (id: string, data: { album_id?: string; permission?: string; tags?: string[] }) => Promise<void>;
  batchOperation: (ids: string[], action: 'delete' | 'move' | 'permission', extra?: Record<string, string>) => Promise<void>;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setFilters: (filters: Record<string, string | undefined>) => void;
}

export const useImagesStore = create<ImagesState>((set, get) => ({
  images: [],
  currentImage: null,
  total: 0,
  page: 1,
  filters: {},
  selectedIds: new Set<string>(),
  isLoading: false,

  fetchImages: async (page = 1, filters) => {
    set({ isLoading: true });
    try {
      const currentFilters = filters || get().filters;
      const res = await imagesApi.getImages({ page, limit: 20, ...currentFilters });
      const responseData = res.data.data;
      set({
        images: responseData?.images || [],
        total: responseData?.pagination?.total || 0,
        page,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchImage: async (id) => {
    set({ isLoading: true });
    try {
      const res = await imagesApi.getImage(id);
      set({ currentImage: res.data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  uploadImages: async (formData, onProgress) => {
    const res = await imagesApi.upload(formData, onProgress);
    return res.data.data;
  },

  deleteImage: async (id) => {
    await imagesApi.deleteImage(id);
    set((state) => ({
      images: state.images.filter((img) => img.id !== id),
      selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
    }));
  },

  updateImage: async (id, data) => {
    const res = await imagesApi.updateImage(id, data);
    const updated = res.data.data;
    set((state) => ({
      images: state.images.map((img) => (img.id === id ? { ...img, ...updated } : img)),
      currentImage: state.currentImage?.id === id ? { ...state.currentImage, ...updated } : state.currentImage,
    }));
    return updated;
  },

  batchOperation: async (ids, action, extra) => {
    await imagesApi.batchOperation({ ids, action, ...extra });
    if (action === 'delete') {
      const idSet = new Set(ids);
      set((state) => ({
        images: state.images.filter((img) => !idSet.has(img.id)),
        selectedIds: new Set(),
      }));
    } else {
      set({ selectedIds: new Set() });
      await get().fetchImages(get().page);
    }
  },

  toggleSelect: (id) => {
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    });
  },

  clearSelection: () => set({ selectedIds: new Set<string>() }),

  setFilters: (filters) => {
    set({ filters });
    get().fetchImages(1, filters as Record<string, string>);
  },
}));
