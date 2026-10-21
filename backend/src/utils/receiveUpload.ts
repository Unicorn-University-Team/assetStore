import type { Upload } from '@aws-sdk/lib-storage';
import busboy from 'busboy';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { FileStorage } from '../storage/file-storage';
import { HttpError } from './HttpError';

export interface UploadedFile {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface UploadOptions {
  fileField: string;
  maxBytes: number;
  allowedExtensions: ReadonlySet<string>;
}

// Reads a multipart/form-data request: text fields are collected, the single file is streamed
// straight to S3 under a generated key. On any error the uploaded object is removed again.
export function receiveUpload(
  req: Request,
  options: UploadOptions,
): Promise<{ fields: Record<string, string>; file?: UploadedFile }> {
  return new Promise((resolve, reject) => {
    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: options.maxBytes, fields: 20, fieldSize: 10_000 },
      });
    } catch {
      reject(new HttpError(400, 'Expected a multipart/form-data request'));
      return;
    }

    const fields: Record<string, string> = {};
    let file: UploadedFile | undefined;
    let s3Upload: Upload | undefined;
    let upload: Promise<unknown> | undefined;
    let failure: HttpError | undefined;

    parser.on('field', (name, value) => {
      fields[name] = value;
    });

    parser.on('file', (field, stream, info) => {
      if (field !== options.fileField || file || failure) {
        stream.resume();
        return;
      }

      const fileName = path.basename(info.filename ?? '').slice(0, 255);
      const extension = path.extname(fileName).slice(1).toLowerCase();
      if (!options.allowedExtensions.has(extension)) {
        failure = new HttpError(400, `Files of type ".${extension}" are not allowed`);
        stream.resume();
        return;
      }

      const uploaded: UploadedFile = {
        key: `assets/${randomUUID()}`,
        fileName,
        contentType: info.mimeType || 'application/octet-stream',
        size: 0,
      };
      file = uploaded;

      const current = FileStorage.upload(uploaded.key, stream, uploaded.contentType);
      s3Upload = current;
      stream.on('data', (chunk: Buffer) => {
        uploaded.size += chunk.length;
      });
      stream.on('limit', () => {
        failure = new HttpError(413, `The file is larger than ${Math.round(options.maxBytes / 1024 / 1024)} MB`);
        void current.abort();
      });
      // Handle the result right away: a rejection that waits until 'close' would crash the process.
      upload = current.done().then(
        () => undefined,
        (error: unknown) => {
          // With a failure already set (size limit, aborted upload) the S3 error is just its consequence.
          if (!failure) {
            console.error(error);
            failure = new HttpError(502, 'Could not store the file');
          }
        },
      );
    });

    parser.on('error', () => {
      failure ??= new HttpError(400, 'Malformed multipart/form-data request');
    });

    // The client went away mid-upload: without this the S3 upload would wait for the rest forever.
    req.on('close', () => {
      if (req.complete) return;
      failure ??= new HttpError(400, 'The upload was interrupted');
      void s3Upload?.abort();
      parser.destroy();
    });

    parser.on('close', async () => {
      await upload;

      if (failure) {
        if (file) await FileStorage.remove(file.key).catch(() => undefined);
        reject(failure);
        return;
      }
      resolve({ fields, file });
    });

    req.pipe(parser);
  });
}
