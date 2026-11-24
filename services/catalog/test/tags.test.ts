// Tag rules of US-1 / US-1.1 (spec tickets A and B, acceptance criteria 1, 4 and 6). Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '@assetstore/shared';
import { normalizeTagList, tagListFromForm } from '../src/utils/tags';

function rejects(value: unknown, message: RegExp) {
  assert.throws(() => normalizeTagList(value), (error: unknown) => error instanceof HttpError && error.status === 400 && message.test(error.message));
}

test('trims, lower-cases and removes duplicates, keeping the order', () => {
  assert.deepEqual(normalizeTagList(['Medieval', '  low-poly ', 'MEDIEVAL', 'Castle-2']), ['medieval', 'low-poly', 'castle-2']);
});

test('no tagList means no tags', () => {
  assert.deepEqual(normalizeTagList(undefined), []);
  assert.deepEqual(normalizeTagList([]), []);
});

test('a wrong name rejects the request and says which one', () => {
  rejects(['ok', 'ca$tle'], /"ca\$tle"/);
  rejects(['a'.repeat(51)], /is not valid/);
  rejects(['   '], /is not valid/);
  rejects(['meč'], /"meč"/);
  rejects(['two words'], /is not valid/);
});

test('50 characters are fine, 51 are not', () => {
  assert.deepEqual(normalizeTagList(['a'.repeat(50)]), ['a'.repeat(50)]);
  rejects(['b'.repeat(51)], /is not valid/);
});

test('at most 10 different tags', () => {
  const ten = Array.from({ length: 10 }, (_, i) => `tag-${i}`);
  assert.equal(normalizeTagList([...ten, 'TAG-0']).length, 10);
  rejects([...ten, 'tag-10'], /at most 10 tags/);
});

test('tagList must be a list of strings', () => {
  rejects('medieval', /must be a list/);
  rejects([1, 2], /must be a list/);
});

test('form: one field per tag, or one JSON array', () => {
  assert.equal(tagListFromForm(undefined), undefined);
  assert.deepEqual(tagListFromForm(['a', 'b']), ['a', 'b']);
  assert.deepEqual(tagListFromForm(['["a","b"]']), ['a', 'b']);
  assert.deepEqual(tagListFromForm(['single']), ['single']);
  assert.throws(() => tagListFromForm(['[broken']), HttpError);
});
