import { HttpError } from '@assetstore/shared';

// Tag rules of US-1 and US-1.1 together: at most 10 tags per asset; a name is trimmed, put in lower case and then
// has 1 to 50 lower case Latin letters, digits or hyphens (BR-05; the same rule as CHECK "tag_name_check").
export const MAX_TAGS_PER_ASSET = 10;
export const TAG_NAME = /^[a-z0-9-]{1,50}$/;

// tagList of asset/create (and later asset/update, US-2) → the tag names to store, in the order given.
// 1. trim, 2. lower case, 3. a name given twice counts once, 4. check the name, 5. at most 10 tags.
// A wrong name rejects the whole request (400 with the name): nothing is created.
export function normalizeTagList(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new HttpError(400, '"tagList" must be a list of tag names');
  }
  const names: string[] = [];
  for (const raw of value as string[]) {
    const name = raw.trim().toLowerCase();
    if (!TAG_NAME.test(name)) {
      throw new HttpError(
        400,
        `Tag "${raw.trim().slice(0, 60)}" is not valid: use 1 to 50 Latin letters, digits or hyphens`,
      );
    }
    if (!names.includes(name)) names.push(name);
  }
  if (names.length > MAX_TAGS_PER_ASSET) throw new HttpError(400, `An asset can have at most ${MAX_TAGS_PER_ASSET} tags`);
  return names;
}

// In multipart/form-data the list comes as one field per tag (tagList=a, tagList=b), or as one field with a JSON
// array (tagList=["a","b"]). Undefined = no tags.
export function tagListFromForm(values: string[] | undefined): unknown {
  if (!values || values.length === 0) return undefined;
  const [only] = values;
  if (values.length === 1 && only !== undefined && only.trim().startsWith('[')) {
    try {
      return JSON.parse(only) as unknown;
    } catch {
      throw new HttpError(400, '"tagList" must be a list of tag names');
    }
  }
  return values;
}
