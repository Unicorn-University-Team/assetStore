import type { Upload } from '@aws-sdk/lib-storage';
import busboy from 'busboy';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { FileStorage } from '../storage/file-storage';
import { HttpError } from '@assetstore/shared';

export interface UploadedFile {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
}

// One file field of the form: its own size limit, allowed extensions and S3 key prefix.
export interface FileRule {
  maxBytes: number;
  allowedExtensions: ReadonlySet<string>;
  keyPrefix: string;
  // Error texts, so the asset file and the preview each name themselves (AM invalidFileType / invalidPreviewType,
  // fileTooLarge / previewTooLarge).
  wrongType: (extension: string) => string;
  tooLarge: string;
  // The stored content type; by default the one the browser sent.
  contentType?: (extension: string) => string;
}

export interface UploadOptions {
  files: Record<string, FileRule>;
}

export type UploadResult = {
  fields: Record<string, string>;
  fieldLists: Record<string, string[]>;
  files: Partial<Record<string, UploadedFile>>;
};

// Reads a multipart/form-data request: text fields are collected, each known file field (at most one file each) is
// streamed straight to S3 under a generated key. On any error every uploaded object is removed again.
// fields keeps the last value of each field; fieldLists keeps all of them (a list such as tagList=a, tagList=b).
export function receiveUpload(req: Request, options: UploadOptions): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const rules = options.files;
    const fieldCount = Object.keys(rules).length;
    const biggest = Math.max(...Object.values(rules).map((rule) => rule.maxBytes));
    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: req.headers,
        limits: { files: fieldCount, fileSize: biggest, fields: 20, fieldSize: 10_000 },
      });
    } catch {
      reject(new HttpError(400, 'Expected a multipart/form-data request'));
      return;
    }

    const fields: Record<string, string> = {};
    const fieldLists: Record<string, string[]> = {};
    const files: Partial<Record<string, UploadedFile>> = {};
    const s3Uploads: Upload[] = [];
    const uploads: Promise<unknown>[] = [];
    let failure: HttpError | undefined;

    parser.on('field', (name, value) => {
      fields[name] = value;
      (fieldLists[name] ??= []).push(value);
    });

    parser.on('file', (field, stream, info) => {
      const rule = rules[field];
      if (!rule || files[field] || failure) {
        stream.resume();
        return;
      }

      const fileName = path.basename(info.filename ?? '').slice(0, 255);
      const extension = path.extname(fileName).slice(1).toLowerCase();
      if (!rule.allowedExtensions.has(extension)) {
        failure = new HttpError(400, rule.wrongType(extension));
        stream.resume();
        return;
      }

      const uploaded: UploadedFile = {
        key: `${rule.keyPrefix}${randomUUID()}`,
        fileName,
        contentType: rule.contentType?.(extension) ?? (info.mimeType || 'application/octet-stream'),
        size: 0,
      };
      files[field] = uploaded;

      const current = FileStorage.upload(uploaded.key, stream, uploaded.contentType);
      s3Uploads.push(current);
      const tooLarge = () => {
        failure ??= new HttpError(413, rule.tooLarge);
        void current.abort();
        // Read the rest of this file away, so the parser reaches the end of the request.
        stream.resume();
      };
      stream.on('data', (chunk: Buffer) => {
        uploaded.size += chunk.length;
        // The parser limit is the biggest of all fields; a smaller limit (the preview) is checked here.
        if (uploaded.size > rule.maxBytes) tooLarge();
      });
      stream.on('limit', tooLarge);
      // Handle the result right away: a rejection that waits until 'close' would crash the process.
      uploads.push(
        current.done().then(
          () => undefined,
          (error: unknown) => {
            // With a failure already set (size limit, aborted upload) the S3 error is just its consequence.
            if (!failure) {
              console.error(error);
              failure = new HttpError(502, 'Could not store the file');
            }
          },
        ),
      );
    });

    parser.on('error', () => {
      failure ??= new HttpError(400, 'Malformed multipart/form-data request');
    });

    // The client went away mid-upload: without this the S3 uploads would wait for the rest forever.
    req.on('close', () => {
      if (req.complete) return;
      failure ??= new HttpError(400, 'The upload was interrupted');
      for (const upload of s3Uploads) void upload.abort();
      parser.destroy();
    });

    parser.on('close', async () => {
      await Promise.all(uploads);

      if (failure) {
        await removeUploaded(files);
        reject(failure);
        return;
      }
      resolve({ fields, fieldLists, files });
    });

    req.pipe(parser);
  });
}

// Removes what receiveUpload stored, e.g. when a later check of the request fails. Errors are ignored.
export async function removeUploaded(files: Partial<Record<string, UploadedFile>>): Promise<void> {
  await Promise.all(
    Object.values(files).map((file) => (file ? FileStorage.remove(file.key).catch(() => undefined) : undefined)),
  );
}
