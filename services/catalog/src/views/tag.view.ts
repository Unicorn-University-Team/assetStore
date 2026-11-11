import type { Tag } from '../models/tag.model';

export interface TagView {
  id: string;
  name: string;
}

export function toTagView(tag: Tag): TagView {
  return { id: tag.id, name: tag.name };
}
