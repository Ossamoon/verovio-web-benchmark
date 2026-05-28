declare interface VerovioModule {
  readonly _malloc: (size: number) => number;
  readonly _free: (ptr: number) => void;
  readonly HEAPU8: Uint8Array;
}

declare module 'verovio/wasm' {
  export default function createVerovioModule(
    options?: Record<string, unknown>
  ): Promise<VerovioModule>;
}

declare module 'verovio/wasm-split' {
  export default function createVerovioModule(
    options?: Record<string, unknown>
  ): Promise<VerovioModule>;
}

declare module 'verovio/wasm-light' {
  export default function createVerovioModule(
    options?: Record<string, unknown>
  ): Promise<VerovioModule>;
}

declare module 'verovio/wasm-light-split' {
  export default function createVerovioModule(
    options?: Record<string, unknown>
  ): Promise<VerovioModule>;
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: VerovioModule);
    destroy(): void;
    getAvailableOptions(): Record<string, unknown>;
    getDefaultOptions(): Record<string, unknown>;
    getOptions(): Record<string, unknown>;
    getPageCount(): number;
    getVersion(): string;
    loadData(data: string): boolean;
    redoLayout(options?: Record<string, unknown>): void;
    renderToSVG(pageNo?: number, xmlDeclaration?: boolean): string;
    setOptions(options: Record<string, unknown>): void;
  }
}
