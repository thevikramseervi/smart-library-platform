export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CatalogListParams {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface Language {
  id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface LanguageCreate {
  name: string;
  code: string;
}

export interface Publisher {
  id: string;
  name: string;
  website: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublisherCreate {
  name: string;
  website?: string | null;
  country?: string | null;
}

export interface PublisherUpdate {
  name?: string;
  website?: string | null;
  country?: string | null;
}

export interface Author {
  id: string;
  name: string;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthorCreate {
  name: string;
  bio?: string | null;
}

export interface AuthorUpdate {
  name?: string;
  bio?: string | null;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  description?: string | null;
}

export interface CategoryUpdate {
  name?: string;
  description?: string | null;
}

export type BookCopyStatus = "AVAILABLE" | "BORROWED" | "RESERVED" | "LOST" | "DAMAGED";

export interface BookCopy {
  id: string;
  book_id: string;
  inventory_code: string;
  qr_code_value: string;
  location: string | null;
  status: BookCopyStatus;
  acquired_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookCopyCreate {
  book_id: string;
  inventory_code: string;
  location?: string | null;
}

export interface BookCopyUpdate {
  location?: string | null;
  status?: BookCopyStatus;
  acquired_date?: string | null;
}

export interface BookCopyListParams extends CatalogListParams {
  book_id?: string;
  status?: BookCopyStatus;
}

export interface Book {
  id: string;
  title: string;
  isbn: string | null;
  publisher_id: string;
  language_id: string;
  edition: string | null;
  publication_year: number | null;
  description: string | null;
  cover_image_url: string | null;
  is_digital: boolean;
  created_at: string;
  updated_at: string;
  publisher?: Publisher;
  language?: Language;
  authors?: Author[];
  categories?: Category[];
  copy_count: number;
  total_copies: number;
  available_copies: number;
}

export interface BookCreate {
  title: string;
  isbn?: string | null;
  publisher_id: string;
  language_id: string;
  edition?: string | null;
  publication_year?: number | null;
  description?: string | null;
  cover_image_url?: string | null;
  is_digital?: boolean;
  author_ids?: string[];
  category_ids?: string[];
}

export interface BookUpdate {
  title?: string;
  isbn?: string | null;
  publisher_id?: string;
  language_id?: string;
  edition?: string | null;
  publication_year?: number | null;
  description?: string | null;
  cover_image_url?: string | null;
  is_digital?: boolean;
  author_ids?: string[];
  category_ids?: string[];
}

export interface BookListParams extends CatalogListParams {
  publisher_id?: string;
  language_id?: string;
  category_id?: string;
  author_id?: string;
  is_digital?: boolean;
}
