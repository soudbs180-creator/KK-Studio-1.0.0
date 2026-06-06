import type JSZip from 'jszip';

type SaveBlob = (data: Blob | string, filename?: string) => void;
type FileSaverRuntimeModule = SaveBlob | {
  default?: SaveBlob;
  saveAs?: SaveBlob;
};
type JSZipConstructor = new () => JSZip;
type JSZipRuntimeModule = JSZipConstructor | {
  default?: JSZipConstructor;
};

export async function createZipArchive(): Promise<JSZip> {
  const zipModule = await import('jszip') as unknown as JSZipRuntimeModule;
  const JSZipRuntime = typeof zipModule === 'function'
    ? zipModule
    : zipModule.default;

  if (!JSZipRuntime) {
    throw new Error('ZIP runtime is unavailable.');
  }

  return new JSZipRuntime();
}

export async function loadFileSaver(): Promise<SaveBlob> {
  const fileSaverModule = await import('file-saver') as unknown as FileSaverRuntimeModule;
  const saveBlob = typeof fileSaverModule === 'function'
    ? fileSaverModule
    : fileSaverModule.saveAs ?? fileSaverModule.default;

  if (!saveBlob) {
    throw new Error('File saver runtime is unavailable.');
  }

  return saveBlob;
}

export async function saveBlobAs(data: Blob | string, filename?: string): Promise<void> {
  const saveBlob = await loadFileSaver();
  saveBlob(data, filename);
}
