export interface FerVector {
  pos: number;
  neu: number;
  fru: number;
}

export type SevenClassVector = [number, number, number, number, number, number, number];

export interface WebcamFerApi {
  ready: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  fer: FerVector;
  enable: () => Promise<void>;
  disable: () => void;
}



