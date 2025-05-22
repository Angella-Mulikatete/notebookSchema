declare module 'mammoth' {
  interface ExtractRawTextOptions {
    arrayBuffer: ArrayBuffer;
    // Add other options if needed later
  }

  interface ExtractRawTextResult {
    value: string;
    messages?: any[]; // Add messages property if it exists in the actual result
  }

  export function extractRawText(options: ExtractRawTextOptions): Promise<ExtractRawTextResult>;

  // Add other functions/types from mammoth if they are used in the project
  // For example:
  // export function convertToHtml(options: any): Promise<any>;
}
